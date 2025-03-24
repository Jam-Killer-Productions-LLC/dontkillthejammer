interface Env {
  IPFS_UPLOAD_URL: string;
  IPFS_API_KEY: string;
  THIRDWEB_SECRET_KEY: string;
  ARTISTICJAMKILLER: Service; // Binding to artistic-worker
  NARRATIVESJAMKILLER: Service; // Binding to jamkillernarrative
  // AJAMKILLERSTORY?: KVNamespace; // Optional new KV namespace (uncomment if needed)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/generate") {
      try {
        const { cryptoAddress, mojoScore } = await request.json();

        // Validate inputs
        if (!cryptoAddress || typeof mojoScore !== "number") {
          return new Response(
            JSON.stringify({ success: false, error: "Missing or invalid cryptoAddress or mojoScore" }),
            { headers: { "Content-Type": "application/json" }, status: 400 }
          );
        }

        // Step 1: Fetch base64 image from artistic-worker via service binding
        const artisticResponse = await env.ARTISTICJAMKILLER.fetch(
          new Request("https://fake-url/get-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cryptoAddress }),
          })
        );
        const { base64Image } = await artisticResponse.json();
        if (!base64Image) {
          return new Response(
            JSON.stringify({ success: false, error: "Image not found from artistic-worker" }),
            { headers: { "Content-Type": "application/json" }, status: 404 }
          );
        }

        // Step 2: Convert base64 to Blob and upload to IPFS
        const imageBlob = base64ToBlob(base64Image, "image/png");
        const imageIpfsHash = await uploadFileToIpfs(imageBlob, env);

        // Step 3: Get narrative from jamkillernarrative via service binding
        const narrativeResponse = await env.NARRATIVESJAMKILLER.fetch(
          new Request("https://fake-url/get-narrative", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mojoScore }),
          })
        );
        const { narrative } = await narrativeResponse.json();
        if (!narrative) {
          throw new Error("Failed to get narrative from jamkillernarrative");
        }

        // Step 4: Create metadata with specific NFT name
        const metadata = {
          name: "Don't Kill the Jam Jam Killer Story NFT",
          description: narrative,
          image: `ipfs://${imageIpfsHash}`,
          mojoScore: mojoScore,
        };

        // Optional: Store metadata in new KV namespace (uncomment if using AJAMKILLERSTORY)
        // await env.AJAMKILLERSTORY?.put(cryptoAddress + "-metadata", JSON.stringify(metadata));

        // Step 5: Upload metadata to IPFS
        const metadataIpfsHash = await uploadJsonToIpfs(metadata, env);

        // Step 6: Mint NFT (placeholder)
        await mintNft(metadataIpfsHash, cryptoAddress, env.THIRDWEB_SECRET_KEY);

        // Step 7: Return URLs
        return new Response(
          JSON.stringify({
            success: true,
            imageUrl: `https://ipfs.io/ipfs/${imageIpfsHash}`,
            metadataUrl: `https://ipfs.io/ipfs/${metadataIpfsHash}`,
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 }
        );
      } catch (error: any) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { headers: { "Content-Type": "application/json" }, status: 500 }
        );
      }
    }

    return new Response("Method Not Allowed or Invalid Endpoint", { status: 405 });
  },
};

// Helper function to convert base64 to Blob
function base64ToBlob(base64: string, mimeType: string): Blob {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

// Function to upload file to IPFS
async function uploadFileToIpfs(fileBlob: Blob, env: Env): Promise<string> {
  const formData = new FormData();
  formData.append("file", fileBlob, "image.png");
  const response = await fetch(env.IPFS_UPLOAD_URL, {
    method: "POST",
    headers: { "x-api-key": env.IPFS_API_KEY },
    body: formData,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`IPFS file upload failed: ${errorText}`);
  }
  const result = await response.json();
  return result.cid;
}

// Function to upload JSON metadata to IPFS
async function uploadJsonToIpfs(metadata: any, env: Env): Promise<string> {
  const response = await fetch(env.IPFS_UPLOAD_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.IPFS_API_KEY,
    },
    body: JSON.stringify(metadata),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`IPFS metadata upload failed: ${errorText}`);
  }
  const result = await response.json();
  return result.cid;
}

// Placeholder function for minting NFT with Thirdweb
async function mintNft(metadataIpfsHash: string, cryptoAddress: string, secretKey: string): Promise<void> {
  const response = await fetch("https://api.thirdweb.com/mint", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${secretKey}`,
    },
    body: JSON.stringify({
      metadataUri: `ipfs://${metadataIpfsHash}`,
      owner: cryptoAddress,
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Minting failed: ${errorText}`);
  }
}