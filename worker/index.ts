export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }

    try {
      const metadata = await request.json();

      const ipfsResponse = await fetch(env.IPFS_UPLOAD_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.IPFS_API_KEY,
        },
        body: JSON.stringify(metadata),
      });

      if (!ipfsResponse.ok) {
        const errorDetail = await ipfsResponse.text();
        throw new Error(`IPFS upload failed: ${errorDetail}`);
      }

      const ipfsResult = await ipfsResponse.json();

      return new Response(JSON.stringify({ success: true, ipfsResult }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("IPFS Upload Error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
};