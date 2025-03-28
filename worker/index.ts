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
  cid: string;
  [key: string]: any;
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
            "Authorization": `Bearer ${env.IPFS_API_KEY}`
          },
          body: JSON.stringify(metadata)
        });
        
        if (!ipfsResponse.ok) {
          throw new Error(`IPFS upload failed: ${ipfsResponse.statusText}`);
        }
        
        const ipfsResponseData = await ipfsResponse.json();
        const ipfsData = ipfsResponseData as IPFSResponse;
        const ipfsUri = `ipfs://${ipfsData.cid}`;
        
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
        const data = await request.json();
        const { metadata, userId } = data as { metadata: any, userId: string };
        
        if (!userId || !metadata) {
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
        
        // Upload to IPFS using the secrets
        const ipfsResponse = await fetch(env.IPFS_UPLOAD_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.IPFS_API_KEY}`
          },
          body: JSON.stringify(metadata)
        });
        
        if (!ipfsResponse.ok) {
          throw new Error(`IPFS upload failed: ${ipfsResponse.statusText}`);
        }
        
        const ipfsResponseData = await ipfsResponse.json();
        const ipfsData = ipfsResponseData as IPFSResponse;
        const ipfsUri = `ipfs://${ipfsData.cid}`;
        
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