interface Env {
  IPFS_UPLOAD_URL: string;
  IPFS_API_KEY: string;
  THIRDWEB_SECRET_KEY: string;
  ARTISTICJAMKILLER: Service; // Binding to artistic-worker
  NARRATIVESJAMKILLER: Service; // Binding to jamkillernarrative
}

// Type for the incoming request payload
interface GenerateRequest {
  cryptoAddress: string;
  mojoScore: number;
}

// Type for artistic-worker response
interface ArtisticResponse {
  base64Image: string | null;
  error?: string;
}

// Type for jamkillernarrative response
interface NarrativeResponse {
  narrative: string | null;
  error?: string;
}

// Type for IPFS upload response (QuickNode)
interface IpfsResponse {
  cid: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Match metaupload.producerprotocol.pro/generate
    if (request.method === "POST" && url.pathname === "/generate") {
      try {
        // Step 1: Parse and type the request JSON
        const { cryptoAddress, mojoScore } = (await request.json()) as GenerateRequest;

        // Validate inputs
        if (!cryptoAddress || typeof mojoScore !== "number") {
          return new Response(
            JSON.stringify({ success: false, error: "Missing or invalid cryptoAddress or mojoScore" }),
            { headers: { "Content-Type": "application/json" }, status: 400 }
          );
        }

        // Step 2: Fetch base64 image from artistic-worker
        const artisticResponse = await env.ARTISTICJAMKILLER.fetch(
          new Request("https://fake-url/get-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cryptoAddress }),
          })
        );
        const artisticData = (await artisticResponse.json()) as ArtisticResponse;
        const base64Image = artisticData.base64Image;
        if (!base64Image) {
          return new Response(
            JSON.stringify({ success: false, error: "Image not found from artistic-worker" }),
            { headers: { "Content-Type": "application/json" }, status: 404 }
          );
        }

        // Step 3: Convert base64 to Blob and upload to IPFS
        const imageBlob = base64ToBlob(base64Image, "image/png");
        const imageIpfsHash = await uploadFileToIpfs(imageBlob, env);

        // Step 4: Get narrative from jamkillernarrative
        const narrativeResponse = await env.NARRATIVESJAMKILLER.fetch(
          new Request("https://fake-url/get-narrative", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mojoScore }),
          })
        );
        const narrativeData = (await narrativeResponse.json()) as NarrativeResponse;
        const narrative = narrativeData.narrative;
        if (!narrative) {
          throw new Error("Failed to get narrative from jamkillernarrative");
        }

        // Step 5: Create metadata with exact NFT name (no dashes)
        const metadata = {
          name: "Dont Kill the Jammer Killer Story NFT",
          description: narrative,
          image: `ipfs://${imageIpfsHash}`,
          mojoScore: mojoScore,
        };

        // Step 6: Upload metadata to IPFS
        const metadataIpfsHash = await uploadJsonToIpfs(metadata, env);

        // Step 7: Mint NFT (placeholder)
        await mintNft(metadataIpfsHash, cryptoAddress, env.THIRDWEB_SECRET_KEY);

        // Step 8: Return URLs
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
  const result = (await response.json()) as IpfsResponse;
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
  const result = (await response.json()) as IpfsResponse;
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