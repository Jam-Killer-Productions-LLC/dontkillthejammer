interface Env {
  ARTISTICJAMKILLER: Service; // Binding to artistic-worker
  NARRATIVESJAMKILLER: Service; // Binding to jamkillernarrative
  IPFS_API_KEY: string;    // Add this
  IPFS_UPLOAD_URL: string; // Add this
}

// Type for the incoming request payload
interface GenerateRequest {
  userId: string;
  prompt: string;
}

// Add these interfaces near the top of your file
interface ImageReadyRequest {
  userId: string;
  image: string;
}

interface IPFSResponse {
  requestid: string;
  status: string;
  created: string;
  pin: {
    cid: string;
    name: string;
    origins: string[];
    meta: any;
    info: {
      size: string;
      delegates: string[];
    };
  };
}

interface Environment {
  IPFS_UPLOAD_URL: string;
  IPFS_API_KEY: string;
  ARTISTICJAMKILLER: Fetcher;
  NARRATIVESJAMKILLER: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Match /generate endpoint
    if (request.method === "POST" && url.pathname === "/generate") {
      try {
        // Step 1: Parse and type the request JSON
        const { userId, prompt } = (await request.json()) as GenerateRequest;

        // Validate inputs
        if (!userId || !prompt) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Missing required fields" 
            }),
            { 
              headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
              }, 
              status: 400 
            }
          );
        }

        // Step 2: Fetch image from artistic-worker
        const artisticResponse = await env.ARTISTICJAMKILLER.fetch(
          new Request("https://artistic-worker.producerprotocol.pro/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              userId,
              prompt
            }),
          })
        );

        if (!artisticResponse.ok) {
          throw new Error(`Artistic worker responded with status ${artisticResponse.status}`);
        }

        // Handle ReadableStream response
        const reader = artisticResponse.body?.getReader();
        if (!reader) {
          throw new Error("No response body from artistic worker");
        }

        let chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const imageBuffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          imageBuffer.set(chunk, offset);
          offset += chunk.length;
        }

        // Convert buffer to base64
        const base64Image = btoa(String.fromCharCode(...imageBuffer));
        if (!base64Image) {
          throw new Error("Failed to convert image buffer to base64");
        }

        // Signal meta upload worker that image is ready
        await env.NARRATIVESJAMKILLER.fetch(
          new Request("https://metaupload.producerprotocol.pro/image-ready", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              userId,
              image: `data:image/png;base64,${base64Image}`
            }),
          })
        );

        // Return success response
        return new Response(
          JSON.stringify({
            success: true,
            message: "Image generated successfully",
            image: `data:image/png;base64,${base64Image}`
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          }
        );

      } catch (error: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message
          }),
          { 
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }, 
            status: 500 
          }
        );
      }
    }

    // Then add this inside your fetch function, right before the final "Method Not Allowed" response
    else if (request.method === "POST" && url.pathname === "/image-ready") {
      try {
        const data = await request.json();
        const { userId, image } = data as ImageReadyRequest;
        
        if (!userId || !image) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Missing required fields" 
            }),
            { 
              headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
              }, 
              status: 400 
            }
          );
        }
        
        // Create metadata with the image
        const metadata = {
          name: "Don't Kill The Jam NFT",
          description: "A Jam Killer Storied Collectors NFT",
          image: image,
          attributes: []
        };
        
        // Upload to IPFS using the secrets
        const ipfsResponse = await fetch(env.IPFS_UPLOAD_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.IPFS_API_KEY}`,
            "x-api-key": env.IPFS_API_KEY  // QuickNode requires this header
          },
          body: JSON.stringify({
            data: metadata,
            pin: true  // QuickNode specific parameter
          })
        });
        
        if (!ipfsResponse.ok) {
          throw new Error(`IPFS upload failed: ${ipfsResponse.statusText}`);
        }
        
        const ipfsResponseData = await ipfsResponse.json();
        const ipfsData = ipfsResponseData as IPFSResponse;
        const ipfsUri = `ipfs://${ipfsData.pin.cid}`;
        
        return new Response(
          JSON.stringify({
            success: true,
            message: "Metadata uploaded to IPFS",
            uri: ipfsUri
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          }
        );
      } catch (error: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message
          }),
          { 
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }, 
            status: 500 
          }
        );
      }
    }

    // Add this handler right before your final "Method Not Allowed" response
    else if (request.method === "POST" && url.pathname === "/upload") {
      try {
        console.log("Starting /upload handler");
        
        const data = await request.json();
        console.log("Request data received, size:", JSON.stringify(data).length);
        
        const { metadata, userId } = data as { metadata: any, userId: string };
        
        if (!userId || !metadata) {
          console.log("Missing required fields");
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Missing required fields" 
            }),
            { 
              headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "https://mojohand.producerprotocol.pro"
              }, 
              status: 400 
            }
          );
        }
        
        console.log("Environment check:", {
          hasUploadUrl: !!env.IPFS_UPLOAD_URL,
          hasApiKey: !!env.IPFS_API_KEY
        });

        // First, upload the image to IPFS if it exists
        let imageIpfsUrl = metadata.image;
        if (metadata.image && metadata.image.startsWith('data:')) {
          console.log("Uploading image to IPFS first");
          
          // Convert base64 to blob
          const base64Data = metadata.image.split(',')[1];
          const binaryData = atob(base64Data);
          const bytes = new Uint8Array(binaryData.length);
          for (let i = 0; i < binaryData.length; i++) {
            bytes[i] = binaryData.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'image/png' });
          
          // Create form data
          const formData = new FormData();
          formData.append('Body', blob);
          formData.append('Key', `image-${userId}.png`);
          formData.append('ContentType', 'image/png');

          const imageResponse = await fetch('https://api.quicknode.com/ipfs/rest/v1/s3/put-object', {
            method: "POST",
            headers: {
              "x-api-key": env.IPFS_API_KEY
            },
            body: formData
          });

          if (!imageResponse.ok) {
            const errorText = await imageResponse.text();
            console.error("Image IPFS error response:", errorText);
            throw new Error(`Image IPFS upload failed: ${imageResponse.status} - ${errorText}`);
          }

          const imageIpfsData = await imageResponse.json() as IPFSResponse;
          imageIpfsUrl = `ipfs://${imageIpfsData.pin.cid}`;
        }
        
        // Then create metadata with the IPFS image URL
        const metadataToUpload = {
          ...metadata,
          image: imageIpfsUrl
        };
        
        // Convert metadata to blob
        const metadataBlob = new Blob([JSON.stringify(metadataToUpload)], { type: 'application/json' });
        
        // Create form data for metadata
        const metadataFormData = new FormData();
        metadataFormData.append('Body', metadataBlob);
        metadataFormData.append('Key', `metadata-${userId}.json`);
        metadataFormData.append('ContentType', 'application/json');
        
        console.log("Uploading metadata to IPFS");
        const ipfsResponse = await fetch('https://api.quicknode.com/ipfs/rest/v1/s3/put-object', {
          method: "POST",
          headers: {
            "x-api-key": env.IPFS_API_KEY
          },
          body: metadataFormData
        });
        
        console.log("IPFS response status:", ipfsResponse.status);
        
        if (!ipfsResponse.ok) {
          const errorText = await ipfsResponse.text();
          console.error("IPFS error response:", errorText);
          throw new Error(`IPFS upload failed: ${ipfsResponse.status} - ${errorText}`);
        }
        
        const ipfsResponseData = await ipfsResponse.json() as IPFSResponse;
        console.log("IPFS upload successful");
        
        const ipfsUri = `ipfs://${ipfsResponseData.pin.cid}`;
        
        return new Response(
          JSON.stringify({
            success: true,
            message: "Metadata uploaded to IPFS",
            uri: ipfsUri
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "https://mojohand.producerprotocol.pro"
            }
          }
        );
      } catch (error: any) {
        console.error("Upload handler error:", error.message, error.stack);
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message
          }),
          { 
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "https://mojohand.producerprotocol.pro"
            }, 
            status: 500 
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: "Method Not Allowed or Invalid Endpoint"
      }), 
      { 
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  },
};