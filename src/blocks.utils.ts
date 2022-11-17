import Crypto from "crypto-js";

export class Block {
  #index: number;
  public previousHash: string;
  public timestamp: number;
  public hash: string;
  public data?: string;

  constructor(
    index: number,
    previousHash: string,
    timestamp: number,
    hash: string,
    data?: string
  ) {
    this.#index = index;
    this.previousHash = previousHash.toString();
    this.timestamp = timestamp;
    this.data = data;
    this.hash = hash.toString();
  }

  public get index() {
    return this.#index;
  }
}

const getGenesisBlock = () => {
  const block = new Block(
    0,
    "0",
    1465154705,
    "816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7",
    "my genesis block!!"
  );
  return block;
};

export let blockchain: Block[] = [getGenesisBlock()];
export const getLatestBlock = () => blockchain[blockchain.length - 1];

export const generateNextBlock = (blockData?: string) => {
  const { index, hash: previousHash } = getLatestBlock();
  console.log({ previousHash, index });
  const hash = calculateHash(
    index + 1,
    previousHash,
    new Date().getTime(),
    blockData
  );
  const block = new Block(
    index + 1,
    previousHash,
    new Date().getTime(),
    hash,
    blockData
  );
  return block;
};

const calculateHash = (
  index: number,
  prevHash: string,
  timestamp: number,
  data?: string
) => Crypto.SHA256(`${index} ${prevHash} ${timestamp} ${data}`).toString();

export const calculateHashForBlock = (block: Block) => {
  return calculateHash(
    block.index,
    block.previousHash,
    block.timestamp,
    block.data
  );
};

export const addBlock = (newBlock: Block) => {
  if (isValidNewBlock(newBlock, getLatestBlock())) {
    blockchain.push(newBlock);
  }
};

export const isValidNewBlock = (newBlock: Block, previousBlock: Block) => {
  if (previousBlock.index + 1 !== newBlock.index) {
    console.log("Not a valid block");
    return false;
  } else if (previousBlock.hash !== newBlock.previousHash) {
    console.log("Error, block hashes collide!");
    return false;
  } else if (calculateHashForBlock(newBlock) !== newBlock.hash) {
    console.log(
      typeof newBlock.hash + " " + typeof calculateHashForBlock(newBlock)
    );
    console.log(
      "invalid hash: " + calculateHashForBlock(newBlock) + " " + newBlock.hash
    );
    return false;
  }
  return true;
};

export const replaceChain = (newBlocks: Block[]) => {
  if (isValidChain(newBlocks) && newBlocks.length > blockchain.length) {
    console.log(
      "Received blockchain is valid. Replacing current blockchain with received blockchain"
    );
    blockchain = newBlocks;
    // broadcast(responseLatestMsg());
  } else {
    console.log("Received blockchain invalid");
  }
};

var isValidChain = (blockchainToValidate: Block[]) => {
  if (
    JSON.stringify(blockchainToValidate[0]) !==
    JSON.stringify(getGenesisBlock())
  ) {
    return false;
  }
  var tempBlocks = [blockchainToValidate[0]];
  for (var i = 1; i < blockchainToValidate.length; i++) {
    if (isValidNewBlock(blockchainToValidate[i], tempBlocks[i - 1])) {
      tempBlocks.push(blockchainToValidate[i]);
    } else {
      return false;
    }
  }
  return true;
};
