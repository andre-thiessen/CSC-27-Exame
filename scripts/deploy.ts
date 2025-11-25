import { ethers } from "hardhat";

async function main() {
  const Secp256r1 = await ethers.getContractFactory("Secp256r1");
  const secp256r1 = await Secp256r1.deploy();

  await secp256r1.deployed();
  console.log("Secp256r1 deployed to:", secp256r1.address);

  const PasskeyWallet = await ethers.getContractFactory("PasskeyWallet");
  const passkeyWallet = await PasskeyWallet.deploy(
    "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
  );

  await passkeyWallet.deployed();
  console.log("PicnicAccount deployed to:", passkeyWallet.address);

  const PasskeyWalletFactory = await ethers.getContractFactory(
    "PasskeyWalletFactory"
  );
  const passkeyWalletFactory = await PasskeyWalletFactory.deploy(
    "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
  );

  await passkeyWalletFactory.deployed();
  console.log(
    "PicnicAccountFactory deployed to:",
    passkeyWalletFactory.address
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
