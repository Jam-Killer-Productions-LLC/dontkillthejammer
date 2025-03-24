interface Env {
  ARTISTICJAMKILLER: Service; // Binding to artistic-worker
}

// Type for the incoming request payload
interface GenerateRequest {
  userId: string;
  prompt: string;
}

// Type for the response
interface GenerateImageResponse {
  message: string;
  userId: string;
  image: string; // base64 encoded image
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
              message: "Missing required fields",
              userId: userId || "",
              image: ""
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

        // Return the response in the expected format
        const response: GenerateImageResponse = {
          message: "Image generated successfully",
          userId: userId,
          image: `data:image/png;base64,${base64Image}`
        };

        return new Response(
          JSON.stringify(response),
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
            message: error.message,
            userId: "",
            image: ""
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
        message: "Method Not Allowed or Invalid Endpoint",
        userId: "",
        image: ""
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