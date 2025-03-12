// Define an interface for the expected update payload
interface UpdateBody {
  tokenId: number;
  updateData: Record<string, any>;
  path?: string;
}

async function handleUpdate(request: Request, env: Env): Promise<Response> {
  try {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // Cast the parsed JSON to the UpdateBody interface
    const body = (await request.json()) as UpdateBody;
    const { tokenId, updateData, path } = body;

    if (!tokenId || !updateData) {
      return new Response(
        JSON.stringify({ error: "Missing parameters. Required: tokenId and updateData" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ... rest of your function code

    // For example:
    // const nftContract = await sdkInstance.getContract(env.NFT_CONTRACT_ADDRESS);
    // const currentMetadata = await nftContract.metadata.get(tokenId);
    // const updatedMetadata = { ...currentMetadata, ...updateData };
    // const updateTx = await nftContract.metadata.update(tokenId, updatedMetadata);

    // return the response after updating metadata
    return new Response(
      JSON.stringify({ message: "NFT updated successfully", tokenId, updateData }),
      {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error updating NFT:", error);
    return new Response(
      JSON.stringify({ error: "Error updating NFT", message: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}