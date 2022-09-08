// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract NFTMarketplace is ERC721URIStorage {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIDs; // total number of items created
    Counters.Counter private _itemsSold; // total number of items sold

    uint256 listingPrice = 0.001 ether; // price to list NFT on marketplace
    address payable owner; // owner of the smart contract

    constructor() ERC721("Metaverse Tokens", "META") {
        owner == payable(msg.sender);
    }

    struct MarketItem {
        uint256 tokenId;
        address payable seller;
        address payable owner;
        uint256 price;
        bool sold;
    }

    mapping(uint256 => MarketItem) private idToMarketItem;

    event MarketItemCreated (uint256 indexed tokenId, address seller, address owner, uint256 price, bool sold);
        
    // return the listing price of the NFT
    function getListingPrice() public view returns(uint256) {
        return listingPrice;
    }

    // update the listing price
    function updatedListingPrice(uint _listingPrice) public payable{
        require(owner == msg.sender, "You are not the owner!");
        listingPrice = _listingPrice;
    }

    // create a NFT in the market
    function createMarketItem(uint256 tokenId, uint256 price) private {
        require(price > 0, "You must list an item with price more than 0!");
        require(msg.value == listingPrice, "The amount of ether sent in the transaction does not equal the listing price!");
        // seller is the msg.sender and owner is the address(this)
        idToMarketItem[tokenId] = MarketItem(tokenId, payable(msg.sender), payable(address(this)), price, false);
        _transfer(msg.sender, address(this), tokenId);
        emit MarketItemCreated (tokenId, msg.sender, address(this), price, true);
    }

    // mints a token and list it in the market
    function createToken(string memory tokenURI, uint256 price) public payable returns(uint) {
        _tokenIDs.increment();
        uint256 newTokenId = _tokenIDs.current();
        _mint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, tokenURI);
        createMarketItem(newTokenId, price);
        return newTokenId;
    }

    // creating the sale of a marketplace item
    // transfers ownership of the item and funds between parties
    function createMarketSale(uint256 tokenId) public payable {
        uint price = idToMarketItem[tokenId].price;
        address seller = idToMarketItem[tokenId].seller;
        require(msg.value == price, "The amount of ethers sent does not equal to the price of the item!");
        idToMarketItem[tokenId].owner = payable(msg.sender); // transfer ownership 
        idToMarketItem[tokenId].seller = payable(address(0));
        idToMarketItem[tokenId].sold = true;
        _itemsSold.increment();
        _transfer(address(this), msg.sender, tokenId);
        payable(owner).transfer(listingPrice);
        payable(seller).transfer(msg.value);
    }

    // return all unsold market items
    function fetchMarketItems() public view returns(MarketItem[] memory) {
        uint itemCount = _tokenIDs.current();
        uint unsoldItemCount = _tokenIDs.current() - _itemsSold.current();
        uint currentIndex = 0;

        MarketItem[] memory items = new MarketItem[](unsoldItemCount);

        for (uint i = 0; i < itemCount; i++) {
            // if items haven't been sold
            if(idToMarketItem[i+1].owner == address(this)) {
                uint currentId = i + 1;
                MarketItem storage currentItem = idToMarketItem[currentId];
                items[currentIndex] = currentItem;
                currentIndex++;
            }
        }
        return items;
    }

    // fetch only items a user has purchased
    function fetchNFTs() public view returns(MarketItem[] memory) {
        uint totalItemCount = _tokenIDs.current();
        uint itemCount = 0;
        uint currentIndex = 0;

        // get the count of the items purchased by a user
        for (uint i = 0; i < totalItemCount; i++) {
            if(idToMarketItem[i+1].owner == msg.sender) {
                itemCount++;
            }
        }

        // create an empty array for storing the items a user has purchased
        MarketItem[] memory items = new MarketItem[](itemCount);

        // loop through all the items
        for (uint i = 0; i < totalItemCount; i++) {
            // check if an item has been purchased by a user
            if(idToMarketItem[i+1].owner == msg.sender) {
                uint currentId = i + 1;
                MarketItem storage currentItem = idToMarketItem[currentId]; // store each of the purchased item 
                items[currentIndex] = currentItem;
                currentIndex++;
            } 
        }
        // return the items array containining each of the items
        return items;
    }

    // return only items a user has listed
    function fetchItemsListed() public view returns(MarketItem[] memory) {
        uint totalItemCount = _tokenIDs.current();
        uint itemCount = 0;
        uint currentIndex = 0;

        // get the count of the items listed or selling by a user
        for (uint i = 0; i < totalItemCount; i++) {
            if(idToMarketItem[i+1].seller == msg.sender) {
                itemCount++;
            }
        }

        // create an empty array for storing the items a user has listed
        MarketItem[] memory items = new MarketItem[](itemCount);

        // loop through all the items
        for (uint i = 0; i < totalItemCount; i++) {
            // check if an item has been listed by a user
            if(idToMarketItem[i+1].seller == msg.sender) {
                uint currentId = i + 1; // it will work as the tokenId 
                MarketItem storage currentItem = idToMarketItem[currentId]; // store each of the listed item 
                items[currentIndex] = currentItem;
                currentIndex++;
            } 
        }
        // return the items array containining each of the items
        return items;
    }

    // allows users to resell a token they have purchased
    function resellToken(uint256 tokenId, uint256 price) public payable {
        require(idToMarketItem[tokenId].owner == msg.sender, "You are not the owner of the token!");
        require(msg.value == listingPrice, "The amount sold does not equal the original listing price of the token!");
        idToMarketItem[tokenId].sold = false;
        idToMarketItem[tokenId].seller = payable(msg.sender); // msg.sender refers to address where the contract is being called from
        idToMarketItem[tokenId].owner = payable(address(this)); // address(this) refers to the address of the instance where the call is being made
        idToMarketItem[tokenId].price = price;
        _itemsSold.decrement();
        _transfer(msg.sender, address(this), tokenId);
    }

    // allow users to cancel their market listing
    function cancelItemListing(uint256 tokenId) public {
        require(idToMarketItem[tokenId].seller == msg.sender, "You are not the seller of the token!");
        require(idToMarketItem[tokenId].sold == false, "The item has been sold already!");
        idToMarketItem[tokenId].owner = payable(msg.sender);
        idToMarketItem[tokenId].seller = payable(address(0)); // address(0) refers to the address of the contract creation
        idToMarketItem[tokenId].sold = true; // mark items sold to the user already
        _itemsSold.increment();
        payable(owner).transfer(listingPrice);
        _transfer(address(this), msg.sender, tokenId);
    }
}