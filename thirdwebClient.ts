import { createThirdwebClient, getContract } from "thirdweb";
import { defineChain } from "thirdweb/chains";

export const client = createThirdwebClient({
  clientId: "YOUR_CLIENT_ID",
});

export const contract = getContract({
  client,
  chain: defineChain(10),
  address: "0x9B4A8c5C1452bF204B65C7DDbe202E7A3c79cF3D",
});