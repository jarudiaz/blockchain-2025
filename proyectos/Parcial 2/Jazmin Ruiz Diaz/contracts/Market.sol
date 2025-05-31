*// SPDX-License-Identifier: MIT*
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
contract Market is ERC721URIStorage, Ownable {
    uint256 public nextTokenId = 0;
    uint96 public constant BASE_PRICE = 0.01 ether;
    *// Estructura que representa un NFT listado para la venta*
    struct Listing {
        address owner; *// Vendedor original*
        uint96 price; *// Precio en wei*
        bool sold; *// Estado de venta*
    }
    *// Mapeo de tokens con su información de venta*
    mapping(uint256 => Listing) public listings;
    *// Eventos según especificación*
    event ItemListed(uint256 indexed tokenId, address owner, uint96 price);
    event ItemSold(uint256 indexed tokenId, address buyer, uint96 price);
    *// Constructor que inicializa la colección y mintea el lote inicial*
    constructor() ERC721("NFT Market", "NFTM") Ownable(msg.sender) {
        _mintInitialBatch();
    }
    *// Función interna para mintear NFTs en lote*
    function _mintInitialBatch() private {
        for (uint256 i = 0; i < 10; i++) {
            _safeMint(owner(), i);
            *// URIs relativas para imágenes locales*
            _setTokenURI(
                i,
                string(abi.encodePacked("nft-", Strings.toString(i), ".jpg"))
            );
            listings[i] = Listing(owner(), BASE_PRICE, false);
            emit ItemListed(i, owner(), BASE_PRICE);
        }
        nextTokenId = 10;
    }
    *// Función para mintear y listar nuevos NFTs*
    function mintAndList(string memory *uri, uint96 *price) external {
        require(_price > 0, "El precio debe ser mayor a 0");
        uint256 tokenId = nextTokenId++;
        _mint(msg.sender, tokenId);
        *setTokenURI(tokenId, *uri);
        listings[tokenId] = Listing(msg.sender, _price, false);
        emit ItemListed(tokenId, msg.sender, _price);
    }
    */***
*     * Compra un NFT listado.*
*     * Transfiere el NFT al comprador y el ETH al vendedor.*
*     * @param _tokenId ID del NFT a comprar*
*     */*
    function buy(uint256 _tokenId) external payable {
        Listing storage listing = listings[_tokenId];
        require(!listing.sold, "El item ya fue vendido");
        require(msg.value >= listing.price, "Fondos insuficientes");
        *// CORRECCIÓN CRÍTICA: Calcular y manejar exceso*
        uint256 excess = msg.value - listing.price;
        listing.sold = true;
        *transfer(listing.owner, msg.sender, *tokenId);
        *// Transferir pago al vendedor*
        (bool success, ) = payable(listing.owner).call{value: listing.price}(
            ""
        );
        require(success, "Transferencia fallida");
        *// Devolver exceso al comprador si existe*
        if (excess > 0) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: excess}(
                ""
            );
            require(refundSuccess, "Refund fallido");
        }
        emit ItemSold(_tokenId, msg.sender, listing.price);
    }
    *// Función para obtener información de listado de un nft*
    function getListing(
        uint256 _tokenId
    ) external view returns (address owner, uint96 price, bool sold) {
        Listing memory listing = listings[_tokenId];
        return (listing.owner, listing.price, listing.sold);
    }
    *// Función para retirar fondos*
    function withdraw() external onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}(
            ""
        );
        require(success, "Retiro fallido");
    }
}