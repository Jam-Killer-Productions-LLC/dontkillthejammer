interface Env {
  IPFS_UPLOAD_URL: string;
  IPFS_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
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
        const errorText = await ipfsResponse.text();
        throw new Error(`IPFS upload failed: ${errorText}`);
      }

      const ipfsResult = await ipfsResponse.json();

      return new Response(JSON.stringify({ success: true, ipfsResult }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }
  },
};