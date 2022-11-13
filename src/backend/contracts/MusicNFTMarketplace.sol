//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/access/Ownable.sol'; // this will be able to have ownable set for us and permissions set for the ownable address
import '@openzeppelin/contracts/token/ERC721/ERC721.sol'; //This will import ERC 721 standard for us


contract MusicNFTMarketplace is ERC721('JAVAMusicNFTMarketplace', 'JMFT'), Ownable {
    string public baseURI = 'https://bafybeidhjjbjonyqcahuzlpt7sznm4xrlbspa3gstop5o47l6gsiaffe.ipfs.nftstorage.link/'; // Im using the link from the tutorial 
    string public baseExtension = '.json'; 
    address public artist; 
    uint256 public royaltyFee;

    struct MarketItems { 
        uint256 tokenId;
        address payable seller; 
        uint256 price;
    }
    MarketItems[] public marketItems;
    
    event MarketItemBought(
        uint256 indexed tokenId, 
        address indexed seller, 
        address buyer, 
        uint256 price
    );
    event MarketItemRelisted (
        uint256 indexed tokenId, 
        address indexed seller, 
        uint256 price
    );

    constructor(uint256 _royaltyFee, address _artist, uint256[] memory _prices) payable { // constructor is payable since the royalty fees will be needed to sell
        require(
            _prices.length * _royaltyFee <= msg.value, 
            'deployer must pay royalty fee for each token listed on the marketplace'
        );
        royaltyFee = _royaltyFee; 
        artist = _artist; 
        for(uint8 i = 0; i < _prices.length; i++) {
            require(_prices[i] > 0, 'Price must be greater than 0');
            _mint(address(this), i);
            marketItems.push(MarketItems(i, payable(msg.sender), _prices[i])); // will pay the msg.sender?
        }

    }

    function updateRoyalteFee(uint256 _royaltyFee) external onlyOwner { // set to external for only outside accounts to do this function and only the person who deployed the contract can call it 
        royaltyFee = _royaltyFee;
    }

    function buyToken(uint256 _tokenId) external payable {
        uint256 price = marketItems[_tokenId].price;
        address seller = marketItems[_tokenId].seller;
        require(msg.value == price, 'Please send the asking price in oreer to complete the purchase');
        marketItems[_tokenId].seller = payable(address(0));
        _transfer(address(this), msg.sender, _tokenId);
        payable(artist).transfer(royaltyFee);
        payable(seller).transfer(msg.value);
        emit MarketItemBought(_tokenId, seller, msg.sender, price);

    }

    function resellToken(uint256 _tokenId, uint256 _price) external payable {
        require(msg.value == royaltyFee, 'must pay royalty');
        require(_price > 0, 'Price must be greater than zero');
        marketItems[_tokenId].price = _price; 
        marketItems[_tokenId].seller = payable(msg.sender);

        _transfer(msg.sender, address(this), _tokenId);
        emit MarketItemRelisted(_tokenId, msg.sender, _price);
    }

    function getAllUnsoldTokens() external view returns(MarketItems[] memory) {
        uint256 unsoldCount = balanceOf(address(this));
        MarketItems[] memory tokens = new MarketItems[](unsoldCount);
        uint256 currentIndex;
        for (uint256 i = 0; i < marketItems.length; i++) {
            if(marketItems[i].seller != address(0)) {
                tokens[currentIndex] =  marketItems[i];
                currentIndex ++;
            }
        }
        return (tokens);
    }

    function getMyTokens() external view returns(MarketItems[] memory) {
        uint256 myTokenCount = balanceOf(msg.sender);
        MarketItems[] memory tokens = new MarketItems[](myTokenCount);
        uint256 currentIndex; 
        for(uint256 i = 0; i < marketItems.length; i ++) {
           if(ownerOf(i) == msg.sender ) {
             tokens[currentIndex] = marketItems[i];
            currentIndex ++;
           }
        }
        return (tokens);
    }

    function _baseURI() internal view virtual override returns(string memory) {
        return baseURI; 
    }
} 