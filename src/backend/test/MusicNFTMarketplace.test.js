const {expect} = require('chai');

// dont need to import mocha or waffle cus hardhat injects it into our libary alread

const toWei = num => ethers.utils.parseEther(num.toString());
const fromWei = num => ethers.utils.formatEther(num);

describe('MusicNFTMarketplace', function () {
    let nftMarketplace; 
    let deployer, artist, user1, user2, users; 
    let royaltyFee = toWei(0.01);
    let URI = 'https://bafybeidhjjbjonyqcahuzlpt7sznm4xrlbspa3gstop5o47l6gsiaffe.ipfs.nftstorage.link/';
    let prices = [toWei(1), toWei(2),toWei(3), toWei(4), toWei(5),toWei(6),toWei(7), toWei(8)]
    let deploymentFees = toWei(prices.length * 0.01);
    beforeEach(async function() {
        // get contract factory and signers here
        const NFTMarketplaceFactory = await ethers.getContractFactory('MusicNFTMarketplace');
        [deployer, artist, user1, user2, ...users] = await ethers.getSigners();

        // deploy music nft marketplace contract 
        nftMarketplace = await NFTMarketplaceFactory.deploy(
            royaltyFee, 
            artist.address, 
            prices, 
            {
                value: deploymentFees
            }

        )
    })
    describe('deployment', function () {
        it('should track name, symbol, uri, royalty fee and artist', async function () {
            const nftName = 'JAVAMusicNFTMarketplace';
            const nftSymbol = 'JMFT';
            expect(await nftMarketplace.name()).to.equal(nftName);
            expect(await nftMarketplace.symbol()).to.equal(nftSymbol);
            expect(await nftMarketplace.baseURI()).to.equal(URI);
            expect(await nftMarketplace.royaltyFee()).to.equal(royaltyFee);
            expect(await nftMarketplace.artist()).to.equal(artist.address);
        })
        it('should mint them list all the music nfts', async function () {
            expect(await nftMarketplace.balanceOf(nftMarketplace.address)).to.equal(8);
            //get each item from market items array 
            await Promise.all(prices.map(async (i, indx) => {
                const item = await nftMarketplace.marketItems(indx);
                expect(item.tokenId).to.equal(indx);
                expect(item.seller).to.equal(deployer.address);
                expect(item.price).to.equal(i)
            }))
        })
        it('ether balance should equal deployment fees', async function () {
            expect(await ethers.provider.getBalance(nftMarketplace.address)).to.equal(deploymentFees);
        })
    })

    describe('updating royalty fee', async () => { 
        it('only deployer should be able to update royalte fee', async function () {
            const fee = toWei(0.02);
            await nftMarketplace.updateRoyalteFee(fee)
            await expect(nftMarketplace.connect(user1).updateRoyalteFee(fee)).to.be.revertedWith('Ownable: caller is not the owner');
            expect(await nftMarketplace.royaltyFee()).to.equal(fee);
        })
     })
    
     describe('buying tokens',  () => {
        it('Should update seller to zero address, transfer nft, pay seller, pay royalty to artist and emit the marketitem bought event', async function () {
            const deployerInitialEthBal = await deployer.getBalance();
            const artistInitialEthBal = await artist.getBalance();

            await expect(nftMarketplace.connect(user1).buyToken(0, {value: prices[0]})).to.emit(nftMarketplace, 'MarketItemBought').withArgs(0, deployer.address, user1.address, prices[0])

            const deployerFinalEthBal = await deployer.getBalance()
            const artistFinalEthBal = await artist.getBalance()

            //item seller should be 0 address 
            expect((await nftMarketplace.marketItems(0)).seller).to.equal('0x0000000000000000000000000000000000000000')
            //seller should receive payment for price of nft sold 
            expect(+fromWei(deployerFinalEthBal)).to.equal(+fromWei(prices[0]) + +fromWei(deployerInitialEthBal))
            //artist shouold receive royalty 
            expect(+fromWei(artistFinalEthBal)).to.equal(+fromWei(royaltyFee) + +fromWei(artistInitialEthBal))
            // buyer should now own the nft 
            expect(await nftMarketplace.ownerOf(0)).to.equal(user1.address);

        })
        it('should fail when ether amount sent with transaction does not equal asking price', async function () {
            await expect(nftMarketplace.connect(user1).buyToken(0, {value: prices[1]}
                )).to.be.revertedWith('Please send the asking price in oreer to complete the purchase')

        })
     })

     describe('Reselling tokens', function () {
        beforeEach(async function () {
            await nftMarketplace.connect(user1).buyToken(0, {value: prices[0]})
        })
        it('should track resale item, inc. ether balance by royalty fee, transfer nft to market place and emit marketitem relisted event', async function () {
            const resalePrice = toWei(2);
            const initMarketBal = await ethers.provider.getBalance(nftMarketplace.address)
            await expect(nftMarketplace.connect(user1).resellToken(0, resalePrice, {value: royaltyFee})).to.emit(nftMarketplace, 'MarketItemRelisted').withArgs(0, user1.address, resalePrice)

            const finalMarketBal = await ethers.provider.getBalance(nftMarketplace.address)
            //expect final market bal to equal init + royalty fee
                expect(+fromWei(finalMarketBal)).to.equal(+fromWei(royaltyFee) + +fromWei(initMarketBal))
            // owner of nft should now be the marketplace
            expect(await nftMarketplace.ownerOf(0)).to.equal(nftMarketplace.address);
            //get item from items mapping then check fields to ensure they are correct
            const item = await nftMarketplace.marketItems(0);
            expect(item.tokenId).to.equal(0);
            expect(item.seller).to.equal(user1.address)
            expect(item.price).to.equal(resalePrice)
        })
        it('should fail if price is set to 0 and royalty fee is not paid', async function () {
            await expect(nftMarketplace.connect(user1).resellToken(0, 0, {value: royaltyFee})).to.be.revertedWith('Price must be greater than zero');
            await expect(nftMarketplace.connect(user1).resellToken(0, toWei(1), {value: 0})).to.be.revertedWith('must pay royalty')
        })
     })

     describe('Getter funcctions', function () {
        let soldItems = [0, 1, 4]
        let ownedByUser1 = [0, 1]
        let ownedByUser2 = [4]
        beforeEach(async function() {
            // user1 purchase item 0 
            await(await nftMarketplace.connect(user1).buyToken(0, {value: prices[0]})).wait();
            //user1 purchases item 1
            await (await nftMarketplace.connect(user1).buyToken(1, {value: prices[1]})).wait();
            // user2 purchases item 4; 
            await (await nftMarketplace.connect(user2).buyToken(4, {value: prices[4]})).wait();
        })
        it('getAllUnsoldTokens should fetch all the marketplace items for sale', async function () {
            const unsoldItems = await nftMarketplace.getAllUnsoldTokens();
            //check to make sure that all the returned unsoldItems have filtered outed the sold items 
            expect(unsoldItems.every(i => soldItems.some(j => j === i.tokenId.toNumber()))).to.equal(true)
            // expect that the length is correct 
            expect(unsoldItems.length === prices.length - soldItems.length).to.equal(true);
        })
        it('getMyTokens should fetch all tokens the user owns', async function () {
            // get items owned by user1
            let myItems = await nftMarketplace.connect(user1).getMyTokens();
            //check that returned my items array is correct 
            expect(myItems.every(i => ownedByUser1.some(j => j === i.tokenId.toNumber()))).to.equal(true)
            expect(ownedByUser1.length === myItems.length).to.equal(true);
            //get items owned by user2 
            myItems = await nftMarketplace.connect(user2).getMyTokens();
            //check that the returened items array is correct 
            expect(myItems.every(i => ownedByUser2.some(j => j === i.tokenId.toNumber()))).to.equal(true);
            expect(ownedByUser2.length === myItems.length).to.equal(true);
        });

     })
})