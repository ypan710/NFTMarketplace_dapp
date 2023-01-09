const {ethers} = require("hardhat")

const main = async () => {
    const contractFactory = await ethers.getContractFactory("NFTMarketplace");
    const contract = await contractFactory.deploy();
    await contract.deployed();
    console.log("Contract deployed to :", contract.address);
    // save the address to use later in frontend
    // contract address: 0xA29DE19Cf08621fA0011023Baf50ED07B1eB8918

}

const runMain = async () => {
    try {
        await main();
        process.exit(0);

    } catch (error) {
        console.log(error);
        process.exit(1);
    }
};

runMain();
