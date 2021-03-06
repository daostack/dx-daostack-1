/**
    helpers for tests
*/

// const Avatar = artifacts.require("./Avatar.sol");


// const DAOToken = artifacts.require("./DAOToken.sol");
// const Reputation = artifacts.require("./Reputation.sol");
// const AbsoluteVote = artifacts.require("./AbsoluteVote.sol");
// const GenesisProtocol = artifacts.require("./GenesisProtocol.sol");
const constants = require('./constants');

function _getDaoStackDependencies (deployer) {
  const contract = require('truffle-contract')
    Avatar = contract(require("@daostack/arc/build/contracts/controller/Avatar"))
    Avatar.setProvider(deployer.provider)

    DAOToken = contract(require("@daostack/arc/build/contracts/controller/DAOToken"))
    DAOToken.setProvider(deployer.provider)

    Reputation = contract(require("@daostack/arc/build/contracts/controller/Reputation"))
    Reputation.setProvider(deployer.provider)

  return {
    Avatar,
    DAOToken,
    Reputation
  }
}



class TestSetup {
  constructor(deployer) {
  }
}

class VotingMachine {
  constructor() {
  }
}

class Organization {
  constructor() {
  }
}

function getProposalAddress(tx) {
    // helper function that returns a proposal object from the ProposalCreated event
    // in the logs of tx
    assert.equal(tx.logs[0].event, 'ProposalCreated');
    const proposalAddress = tx.logs[0].args.proposaladdress;
    return proposalAddress;
}

function getValueFromLogs(tx, arg, eventName, index=0) {
  /**
   *
   * tx.logs look like this:
   *
   * [ { logIndex: 13,
   *     transactionIndex: 0,
   *     transactionHash: '0x999e51b4124371412924d73b60a0ae1008462eb367db45f8452b134e5a8d56c8',
   *     blockHash: '0xe35f7c374475a6933a500f48d4dfe5dce5b3072ad316f64fbf830728c6fe6fc9',
   *     blockNumber: 294,
   *     address: '0xd6a2a42b97ba20ee8655a80a842c2a723d7d488d',
   *     type: 'mined',
   *     event: 'NewOrg',
   *     args: { _avatar: '0xcc05f0cde8c3e4b6c41c9b963031829496107bbb' } } ]
   */
  if (!tx.logs || !tx.logs.length) {
    throw new Error('getValueFromLogs: Transaction has no logs');
  }

  if (eventName !== undefined) {
    for (let i=0; i < tx.logs.length; i++) {
      if (tx.logs[i].event  === eventName) {
        index = i;
        break;
      }
    }
    if (index === undefined) {
      let msg = `getValueFromLogs: There is no event logged with eventName ${eventName}`;
      throw new Error(msg);
    }
  } else {
    if (index === undefined) {
      index = tx.logs.length - 1;
    }
  }
  let result = tx.logs[index].args[arg];
  if (!result) {
    let msg = `getValueFromLogs: This log does not seem to have a field "${arg}": ${tx.logs[index].args}`;
    throw new Error(msg);
  }
  return result;
}

async function getProposal(tx) {
    return await Proposal.at(getProposalAddress(tx));
}

async function etherForEveryone() {
    // give all web3.eth.accounts some ether
    let accounts = web3.eth.accounts;
    for (let i=0; i < 10; i++) {
        await web3.eth.sendTransaction({to: accounts[i], from: accounts[0], value: web3.toWei(0.1, "ether")});
    }
}

const outOfGasMessage = 'VM Exception while processing transaction: out of gas';

function assertJumpOrOutOfGas(error) {
    let condition = (
        error.message === outOfGasMessage ||
        error.message.search('invalid JUMP') > -1
    );
    assert.isTrue(condition, 'Expected an out-of-gas error or an invalid JUMP error, got this instead: ' + error.message);
}

function assertVMException(error) {
    let condition = (
        error.message.search('VM Exception') > -1
    );
    assert.isTrue(condition, 'Expected a VM Exception, got this instead:' + error.message);
}

function assertInternalFunctionException(error) {
    let condition = (
        error.message.search('is not a function') > -1
    );
    assert.isTrue(condition, 'Expected a function not found Exception, got this instead:' + error.message);
}

function assertJump(error) {
  assert.isAbove(error.message.search('invalid JUMP'), -1, 'Invalid JUMP error must be returned' + error.message);
}

const setupAbsoluteVote = async function (isOwnedVote=true, precReq=50,reputationAccount=0) {
  var votingMachine = new VotingMachine();
  var accounts = web3.eth.accounts;
  votingMachine.absoluteVote = await AbsoluteVote.new();

  // set up a reputation system
  var reputation = await Reputation.new();
  //var avatar = await Avatar.new('name', helpers.NULL_ADDRESS, reputation.address);
  votingMachine.reputationArray = [20, 40 ,70];
  await reputation.mint(accounts[0], votingMachine.reputationArray[0]);
  await reputation.mint(accounts[1], votingMachine.reputationArray[1]);
  if (reputationAccount === 0){
    await reputation.mint(accounts[2], votingMachine.reputationArray[2]);
  }else {
    await reputation.mint(reputationAccount, votingMachine.reputationArray[2]);
  }
  // register some parameters
  await votingMachine.absoluteVote.setParameters(reputation.address, precReq, isOwnedVote);
  votingMachine.params = await votingMachine.absoluteVote.getParametersHash(reputation.address, precReq, isOwnedVote);
  return votingMachine;
};

const setupGenesisProtocol = async function (accounts,token,
  _preBoostedVoteRequiredPercentage=50,
  _preBoostedVotePeriodLimit=60,
  _boostedVotePeriodLimit=60,
  _thresholdConstA=1,
  _thresholdConstB=1,
  _minimumStakingFee=0,
  _quietEndingPeriod=0,
  _proposingRepRewardConstA=60,
  _proposingRepRewardConstB=1,
  _stakerFeeRatioForVoters=10,
  _votersReputationLossRatio=10,
  _votersGainRepRatioFromLostRep=80,
  _daoBountyConst=15,
  _daoBountyLimt=10
  ) {
  var votingMachine = new VotingMachine();
  votingMachine.genesisProtocol = await GenesisProtocol.new(token,{gas: constants.ARC_GAS_LIMIT});

  // set up a reputation system
  votingMachine.reputationArray = [20, 10 ,70];
  // register some parameters
  await votingMachine.genesisProtocol.setParameters([_preBoostedVoteRequiredPercentage,
                                                 _preBoostedVotePeriodLimit,
                                                 _boostedVotePeriodLimit,
                                                 _thresholdConstA,
                                                 _thresholdConstB,
                                                 _minimumStakingFee,
                                                 _quietEndingPeriod,
                                                 _proposingRepRewardConstA,
                                                 _proposingRepRewardConstB,
                                                 _stakerFeeRatioForVoters,
                                                 _votersReputationLossRatio,
                                                 _votersGainRepRatioFromLostRep,
                                                 _daoBountyConst,
                                                 _daoBountyLimt]);
  votingMachine.params = await votingMachine.genesisProtocol.getParametersHash([_preBoostedVoteRequiredPercentage,
                                                 _preBoostedVotePeriodLimit,
                                                 _boostedVotePeriodLimit,
                                                 _thresholdConstA,
                                                 _thresholdConstB,
                                                 _minimumStakingFee,
                                                 _quietEndingPeriod,
                                                 _proposingRepRewardConstA,
                                                 _proposingRepRewardConstB,
                                                 _stakerFeeRatioForVoters,
                                                 _votersReputationLossRatio,
                                                 _votersGainRepRatioFromLostRep,
                                                 _daoBountyConst,
                                                 _daoBountyLimt]);

  return votingMachine;
};

const setupOrganizationWithArrays = async function (daoCreator,daoCreatorOwner,founderToken,founderReputation,controller=0,cap=0) {
  var org = new Organization();
  var tx = await daoCreator.forgeOrg("testOrg","TEST","TST",daoCreatorOwner,founderToken,founderReputation,controller,cap,{gas: constants.ARC_GAS_LIMIT});
  assert.equal(tx.logs.length, 1);
  assert.equal(tx.logs[0].event, "NewOrg");
  var avatarAddress = tx.logs[0].args._avatar;
  org.avatar = await Avatar.at(avatarAddress);
  var tokenAddress = await org.avatar.nativeToken();
  org.token = await DAOToken.at(tokenAddress);
  var reputationAddress = await org.avatar.nativeReputation();
  org.reputation = await Reputation.at(reputationAddress);
  return org;
};

const setupOrganization = async function (
  daoCreator,
  daoCreatorOwner,
  founderToken,
  founderReputation,
  controller = 0,
  cap = 0) {
  var org = new Organization();
  var tx = await daoCreator.forgeOrg(
    // org name
    "testOrg",
    // token name
    "TEST",
    // token symbol
    "TST",
    [daoCreatorOwner],
    [founderToken],
    [founderReputation],
    controller,
    cap,{
      gas: constants.ARC_GAS_LIMIT
    });

  assert.equal(tx.logs.length, 1);
  assert.equal(tx.logs[0].event, "NewOrg");

  var avatarAddress = tx.logs[0].args._avatar;
  org.avatar = await Avatar.at(avatarAddress);

  var tokenAddress = await org.avatar.nativeToken();
  org.token = await DAOToken.at(tokenAddress);

  var reputationAddress = await org.avatar.nativeReputation();
  org.reputation = await Reputation.at(reputationAddress);
  
  return org;
};


const checkVoteInfo = async function(absoluteVote,proposalId, voterAddress, _voteInfo) {
  let voteInfo;
  voteInfo = await absoluteVote.voteInfo(proposalId, voterAddress);
  // voteInfo has the following structure
  // int vote;
  assert.equal(voteInfo[0], _voteInfo[0]);
  // uint reputation;
  assert.equal(voteInfo[1], _voteInfo[1]);
};


const checkVotesStatus = async function(proposalId, _votesStatus,votingMachine){

  let voteStatus;
  for (var i = 0; i < _votesStatus.length; i++) {
      voteStatus = await votingMachine.voteStatus(proposalId,i);
      assert.equal(voteStatus, _votesStatus[i]);
  }
};


// Increases testrpc time by the passed duration in seconds
const increaseTime = async function(duration) {
  const id = Date.now();

  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [duration],
      id: id,
    }, err1 => {
      if (err1) return reject(err1);

      web3.currentProvider.sendAsync({
        jsonrpc: '2.0',
        method: 'evm_mine',
        id: id + 1,
      }, (err2, res) => {
        return err2 ? reject(err2) : resolve(res);
      });
    });
  });
};

const NULL_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';
const SOME_HASH = '0x1000000000000000000000000000000000000000000000000000000000000000';
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const SOME_ADDRESS = '0x1000000000000000000000000000000000000000';

module.exports = {
  NULL_HASH,
  SOME_HASH,
  NULL_ADDRESS,
  SOME_ADDRESS,
  setupOrganization
}