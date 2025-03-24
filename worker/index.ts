interface Env {
  ARTISTICJAMKILLER: Service; // Binding to artistic-worker
}

// Type for the incoming request payload
interface GenerateRequest {
  cryptoAddress: string;
  prompt?: string;
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
        const { cryptoAddress, prompt } = (await request.json()) as GenerateRequest;

        // Validate inputs
        if (!cryptoAddress) {
          return new Response(
            JSON.stringify({ success: false, error: "Missing cryptoAddress" }),
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
              cryptoAddress,
              prompt: prompt || "Create an NFT image for \"Don't Kill The Jam - A Jam Killer Storied Collectors NFT\". The image should evoke a dystopian, rebellious musical world with neon highlights and gritty, futuristic details."
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

        // Return the image directly
        return new Response(imageBuffer, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*"
          },
        });

      } catch (error: any) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
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

    return new Response("Method Not Allowed or Invalid Endpoint", { 
      status: 405,
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    });
  },
};