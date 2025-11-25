// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@account-abstraction/contracts/samples/SimpleAccount.sol";
import "./Secp256r1.sol";
import "./utils/Base64.sol";

contract PasskeyWallet is SimpleAccount {
    mapping(bytes32 => PassKeyId) private authorisedKeys;
    bytes32[] private knownKeyHashes;

    constructor(IEntryPoint anEntryPoint) SimpleAccount(anEntryPoint) {}

    /**
     * The initializer for the PicnicAccount instance.
     * @param _keyId the id of the key
     * @param _pubKeyX public key X val from a passkey that will have a full ownership and control of this account.
     * @param _pubKeyY public key X val from a passkey that will have a full ownership and control of this account.
     */
    function initialize(
        string calldata _keyId,
        uint256 _pubKeyX,
        uint256 _pubKeyY
    ) public virtual initializer {
        super._initialize(address(0));
        _addPassKey(
            keccak256(abi.encodePacked(_keyId)),
            _pubKeyX,
            _pubKeyY,
            _keyId
        );
    }

    /**
     * Allows the owner to add a passkey key.
     * @param _keyId the id of the key
     * @param _pubKeyX public key X val from a passkey that will have a full ownership and control of this account.
     * @param _pubKeyY public key X val from a passkey that will have a full ownership and control of this account.
     */
    function addPassKey(
        string calldata _keyId,
        uint256 _pubKeyX,
        uint256 _pubKeyY
    ) external onlyOwner {
        _addPassKey(
            keccak256(abi.encodePacked(_keyId)),
            _pubKeyX,
            _pubKeyY,
            _keyId
        );
    }

    function _addPassKey(
        bytes32 _keyHash,
        uint256 _pubKeyX,
        uint256 _pubKeyY,
        string calldata _keyId
    ) internal {
        authorisedKeys[_keyHash] = PassKeyId(_pubKeyX, _pubKeyY, _keyId);
        knownKeyHashes.push(_keyHash);
    }

    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual override returns (uint256 validationData) {
        (
            bytes32 keyHash,
            uint256 sigx,
            uint256 sigy,
            bytes memory authenticatorData,
            string memory clientDataJSONPre,
            string memory clientDataJSONPost
        ) = abi.decode(
                userOp.signature,
                (bytes32, uint256, uint256, bytes, string, string)
            );

        string memory opHashBase64 = Base64.encode(bytes.concat(userOpHash));
        string memory clientDataJSON = string.concat(
            clientDataJSONPre,
            opHashBase64,
            clientDataJSONPost
        );
        bytes32 clientHash = sha256(bytes(clientDataJSON));
        bytes32 sigHash = sha256(bytes.concat(authenticatorData, clientHash));

        PassKeyId memory passKey = authorisedKeys[keyHash];
        require(passKey.pubKeyX != 0 && passKey.pubKeyY != 0, "Key not found");
        require(
            Secp256r1.Verify(passKey, sigx, sigy, uint256(sigHash)),
            "Invalid signature"
        );
        return 0;
    }
}
