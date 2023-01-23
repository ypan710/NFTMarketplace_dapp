const {expect} = require("chai");
const {ethers} = require("hardhat");

describe("NFT Marketplace", function () {
    let NFTMarket;
    let nftMarket;
    let listingPrice;
    let contractOwner;
    let buyerAddress;
    let nftMarketAddress

    // returns a BigNumber representation of value, parsed with
    // digits (if it's a number) or from the unit specified (if it's a string)
    const auctionPrice = ethers.utils.parseUnits("100", "ether")

    // hooks that perform before each test case
    beforeEach(async () => { // get contract that we're targeting, so we can deploy or call the functions in that Contract
        NFTMarket = await ethers.getContractFactory("NFTMarketplace");

        // create a transaction to deploy the transaction and sends it to the network
        // using the contract Signer, and returning a Promise to resolve to a Contract
        nftMarket = await NFTMarket.deploy();

        // return a Promise which will resolve once the contract is deployed
        // or reject if there was an error during deployment
        await nftMarket.deployed();
        nftMarketAddress = nftMarket.address;
        [contractOwner, buyerAddress] = await ethers.getSigners(); // get public address of the user wallet
        listingPrice = await nftMarket.getListingPrice();
        listingPrice = listingPrice.toString();
    })

    // mint and list NFT
    const mintAndListNFT = async (tokenURI, auctionPrice) => {
        const transaction = await nftMarket.createToken(tokenURI, auctionPrice, {value: listingPrice});
        const receipt = await transaction.wait();
        const tokenId = receipt.events[0].args.tokenId;
        return tokenId;
    }

    describe("Mint and list a new NFT token", function () {
        const tokenURI = "https://dummy-token.url/"; // test with a dummy token URI
        it("Should revert if price is 0", async () => {
            await expect(mintAndListNFT(tokenURI, 0)).to.be.revertedWith("You must list an item with price more than 0!");
        })

        it("Should revert if listing price is not correct", async () => {
            await expect(nftMarket.createToken(tokenURI, auctionPrice, {value: 0})).to.be.revertedWith("The amount of ether sent in the transaction does not equal the listing price!");
        })

        it("Should create an NFT with the correct owner and tokenURI", async () => {
            const tokenId = await mintAndListNFT(tokenURI, auctionPrice);
            const mintedTokenURI = await nftMarket.tokenURI(tokenId); // tokenURI is a pre-defined function in ERC721 standard
            const ownerAddress = await nftMarket.ownerOf(tokenId); // ownerOf is a pre-defined function in ERC721 standard

            expect(ownerAddress).to.equal(nftMarketAddress);
            expect(mintedTokenURI).to.equal(tokenURI);
        })

        it("Should emit MarketItemCreated event after successfully listing of NFT", async () => {
            const transaction = await nftMarket.createToken(tokenURI, auctionPrice, {value: listingPrice});
            const receipt = await transaction.wait();
            const tokenID = receipt.events[0].args.tokenId;
            expect(transaction).to.emit(nftMarket, "MarketItemCreated").withArgs(tokenID, contractOwner.address, nftMarketAddress, auctionPrice, false);
        })
    })

    describe("Execute sale of a marketplace item", function () {
        const tokenURI = "https://dummy-token.url/"; // test with a dummy token URI

        it("Should revert if auction price is not correct", async () => {
            const newNFTToken = await mintAndListNFT(tokenURI, auctionPrice)
            await expect(nftMarket.connect(buyerAddress).createMarketSale(newNFTToken, {value: 1})).to.be.revertedWith("The amount of ethers sent does not equal to the price of the item!")
        })

        it("Buy a new token and check token owner address", async () => {
            const newNFTToken = await mintAndListNFT(tokenURI, auctionPrice);
            const oldOwnerAddress = await nftMarket.ownerOf(newNFTToken);

            // now the owner is the marketplace address
            expect(oldOwnerAddress).to.equal(nftMarketAddress);
            await nftMarket.connect(buyerAddress).createMarketSale(newNFTToken, {value: auctionPrice});

            const newOwnerAddress = await nftMarket.ownerOf(newNFTToken);

            // now the owner is the buyer address
            expect(newOwnerAddress).to.equal(buyerAddress.address);
        })

        describe("Resale of a marketplace item", async () => {
            const tokenURI = "https://dummy-token.url/"; // test with a dummy token URI
            const newNFTToken = await mintAndListNFT(tokenURI, auctionPrice);
            await nftMarket.connect(buyerAddress).createMarketSale(newNFTToken, {value: auctionPrice});
            await expect(nftMarket.resellToken(nftMarket, auctionPrice, {value: listingPrice})).to.be.revertedWith("You are not the owner of the token!");
            await expect(nftMarket.connect(buyerAddress).resellToken(newNFTToken, auctionPrice, {value: 0})).to.be.rejectedWith("The amount sold does not equal the original listing price of the token!");

        })

        describe("Fetch marketplace item", async () => {
            const tokenURI = "https://dummy-token.url/"; // test with a dummy token URI
            it("Should fetch the correct number of unsold item", async () => { // we have three items in the marketplace
                await mintAndListNFT(tokenURI, auctionPrice);
                await mintAndListNFT(tokenURI, auctionPrice);
                await mintAndListNFT(tokenURI, auctionPrice);

                let unsoldItems = await nftMarket.fetchMarketItems();
                expect(unsoldItems.length).to.equal(3);
            })

            it("Should fetch the correct number of items the user has purchased", async () => {
                let nftToken = mintAndListNFT(tokenURI, auctionPrice);

                // two NFTs still listed in the marketplace
                await mintAndListNFT(tokenURI, auctionPrice);
                await mintAndListNFT(tokenURI, auctionPrice);

                // let itemsPurchased = await nftMarket.fetchNFTs();
                // expect(itemsPurchased.length).to.equal(3);
                await nftMarket.connect(buyerAddress).createMarketSale(nftToken, {value: auctionPrice});

                let buyerTotalItems = await nftMarket.connect(buyerAddress).fetchNFTs();
                expect(buyerTotalItems.length).to.equal(1); // bought only 1 NFT
            })

            it("Should fetch correct number of items listed by a user", async () => { // two NFTs listed in the marketplace
                await mintAndListNFT(tokenURI, auctionPrice);
                await mintAndListNFT(tokenURI, auctionPrice);
                await nftMarket.connect(buyerAddress).createToken(tokenURI, auctionPrice, {value: listingPrice});
                let itemListed = await nftMarket.fetchItemsListed();
                expect(itemListed.length).to.equal(2);
            })

        })

        describe("Cancel a marketplace listing", async () => {
            const tokenURI = "https://dummy-token.url/"; // test with a dummy token URI
            it("Should cancel and return the correct number of listings", async () => {
                let nftToken = await mintAndListNFT(tokenURI, auctionPrice);
                await nftMarket.connect(buyerAddress).createToken(tokenURI, auctionPrice, {value: listingPrice});
                await nftMarket.connect(buyerAddress).createToken(tokenURI, auctionPrice, {value: listingPrice});

                let unsoldItems = await nftMarket.fetchMarketItems();
                await expect(unsoldItems.length).to.equal(3);
                await nftMarket.cancelItemListing(nftToken);
                unsoldItems = await nftMarket.fetchMarketItems();
                await expect(unsoldItems.length).to.equal(2);
                []
            })
        })
    });
})
