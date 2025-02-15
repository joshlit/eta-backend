import 'dotenv/config'
import express from 'express';
import bodyParser from 'body-parser';

import * as staking from './staking-mechanics';
import * as questing from './questing';
import * as auction from './auction-house';
import * as ballotBox from './ballot-box';
import * as items from './items';
import Functions from './functions/index';
import { bidOnAuction, createAuction, deleteAuction, getActiveAuctions, getAuctionInfo, getPastAuctions } from './functions/astra-auction-house';
import cors from 'cors';
import mongoose, { dbDisconnect } from './mongodb-client';

const app = express();
app.use(cors({
    origin: '*'
}));

app.use(function (req, res, next) {
    // Website you wish to allow to connect
    if (req.headers.origin) {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    }

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', 1);

    // Pass to next layer of middleware
    next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
})); 

app.get('/', async (req, res) => {
  res.json({ message: "Access denied!" });
});

app.get('/build', async (req, res) => {
  res.json({ build: "1.0.1" });
});

app.get("/wl", async (req, res) => {
  let result = await staking.addWhitelist(req.query.wallet, req.query.secret);
  res.json(result);
});

app.get("/user", async (req, res) => {
  let result = await Functions.getUser(req.query.wallet);
  res.json(result);
});

app.get("/userRoles", async (req, res) => {
  let result = await Functions.getUserRoles(req.query?.wallet?.toString());
  res.json(result);
});

app.get("/tokens", async (req, res) => {
  let result = await staking.doGetTokensInWallet(req.query.wallet);
  res.json(result);
});

app.get("/grims-state", async (req, res) => {
  let result = await staking.doGetGrimsState(req.query.wallet);
  res.json(result);
});

app.get("/verify-astra", async (req, res) => {
  let result = await staking.verifyAstra(req.query.wallet, req.query.amount);
  res.json(result);
});

app.get("/quests", async (req, res) => {
  let result = await questing.getAvailableQuests(req.query.includeDisabled);
  res.json(result);
});

app.get("/quest/:id", async (req, res) => {
  let result = await questing.getQuest(req.params.id);
  res.json(result);
});

app.post("/quests/start", async (req, res) => {
  let result = await questing.startQuest(req.body.wallet, req.body.quest, req.body.participants, req.body.message, req.body.bh);
  res.json(result);
});

app.post("/quests/finish", async (req, res) => {
  let result = await questing.finishQuest(req.body.wallet, req.body.quest, req.body.endStepId, req.body.message, req.body.bh);
  res.json(result);
});

app.post("/quests/claim", async (req, res) => {
  let result = await questing.claimRewards(req.body.wallet, req.body.quest, req.body.message, req.body.bh);
  res.json(result);
});

app.get("/quests/active", async (req, res) => {
  let result = await questing.getStartedQuests(req.query.wallet, req.query.quest);
  res.json(result);
});

app.get("/quests/start", async (req, res) => {
  let result = await questing.startQuest(req.query.wallet, req.query.quest, req.query.participants, req.query.message, req.query.bh);
  res.json(result);
});

app.get("/quests/finish", async (req, res) => {
  let result = await questing.finishQuest(req.query.wallet, req.query.quest, req.query.endStepId, req.query.message, req.query.bh);
  res.json(result);
});

app.get("/quests/claim", async (req, res) => {
  let result = await questing.claimRewards(req.query.wallet, req.query.quest, req.query.message, req.query.bh);
  res.json(result);
});

app.post("/admin/quest/update", async (req, res) => {
  let result = await questing.updateQuest(req.body);
  res.json(result);
});

app.post("/admin/item/create", async (req, res) => {
  let result = await items.createItem(req.body);
  res.json(result);
});
app.post("/admin/item/all", async (req, res) => {
  let result = await items.getAllItems();
  res.json(result);
});

app.get("/auction-house", async (req, res) => {
  let rafflesPromise = auction.getActiveRaffles(req.query.wallet);
  let auctionsPromise = getActiveAuctions(req.query.wallet.toString());
  
  await Promise.all([rafflesPromise, auctionsPromise]).then(values => {

    const valueError = values.find(a => a.error);
    if (valueError) {
      return res.json(valueError);
    }

    let raffles = values[0].raffles;
    for (let raffle of raffles) {
      raffle.type = "RAFFLE";
    }
    let auctions = values[1].auctions;
    for (let auction of auctions) {
      auction.type = "AUCTION";
    }

    let events = raffles;
    events = events.concat(auctions);
    
    
    res.json({
      success: true,
      events: events,
      astraBalance: values[0].astraBalance
    });
  })
});

app.get("/auction-house/past-events", async (req, res) => {
    
  let rafflesPromise = auction.getPastRaffles();
  let auctionsPromise = getPastAuctions();
  
  await Promise.all([rafflesPromise, auctionsPromise]).then(values => {

    let raffles = values[0].raffles;
    for (let raffle of raffles) {
      raffle.type = "RAFFLE";
    }
    let auctions = values[1].auctions;
    for (let auction of auctions) {
      auction.type = "AUCTION";
    }

    let events = raffles;
    events = events.concat(auctions);
    
    
    res.json({
      success: true,
      events: events,
    });
  })
});
  
app.get("/auction-house/my-raffles", async (req, res) => {
    const result = await auction.getMyRaffles(req.query.wallet);
    res.json(result);
});

app.post("/auction-house/buy-tickets", async (req, res) => {
  let result = await auction.buyTickets(req.body.wallet, req.body.raffle, Number(req.body.tickets), req.body.message, req.body.bh);
  res.json(result);
});

app.post("/auction-house/create-raffle", async (req, res) => {
  let result = await auction.createRaffle(req.body);
  res.json(result);
});

app.post("/auction-house/update-raffle-winners", async (req, res) => {
  let result = await auction.updateRaffleWinners(req.body);
  res.json(result);
});

app.post("/auction-house/create-auction", async (req, res) => {
  let result = await createAuction(req.body);
  res.json(result);
});

app.post("/auction-house/delete-auction", async (req, res) => {
  let result = await deleteAuction(req.body);
  res.json(result);
});

app.post("/astra-house/auction/info", async (req, res) => {
  let result = await getAuctionInfo(req.body.auction, req.body.wallet);
  res.json(result);
});

app.post("/astra-house/auction/bid", async (req, res) => {
  let result = await bidOnAuction(req.body.wallet, req.body.auction, Number(req.body.bid), Number(req.body.currentBid), req.body.message, req.body.bh);
  res.json(result);
});

app.get("/ballot-box", async (req, res) => {
  let result = await ballotBox.getActiveProposals(req.query.wallet);
  res.json(result);
});

app.get("/ballot-box/wallet-votes", async (req, res) => {
  let result = await ballotBox.getWalletVotes(req.query.wallet, req.query.proposalID);
  res.json(result);
});

app.get("/ballot-box/results", async (req, res) => {
  let result = await ballotBox.getResults(req.query.proposalID);
  res.json(result);
});

app.post("/ballot-box/create-proposal", async (req, res) => {
  let result = await ballotBox.createProposal(req.body);
  res.json(result);
});

app.post("/ballot-box/submit-vote", async (req, res) => {
  let result = await ballotBox.submitVote(req.body.wallet, req.body.proposalID, req.body.votes, req.body.voteWeight, req.body.message, req.body.bh);
  res.json(result);
});

app.get("/public-state", async (req, res) => {
  let result = await staking.doGetPublicState();
  res.json(result);
});

app.get("/transactions", async (req, res) => {
  let result = await staking.getTransactions(req.query.wallet);
  res.json(result);
});

app.post("/claim-points", async (req, res) => {
  let result = await staking.doClaimPoints(req.body.wallet, req.body.message, req.body.bh);
  res.json(result);
});

app.post("/stake", async (req, res) => {
  let tokens = Array.isArray(req.body.tokens) ? req.body.tokens : [req.body.tokens];
  let result = await staking.doStake(req.body.wallet, tokens, req.body.message, req.body.bh);
  res.json(result);
});

app.post("/unstake", async (req, res) => {
  let tokens = Array.isArray(req.body.tokens) ? req.body.tokens : [req.body.tokens];
  let result = await staking.doUnstake(req.body.wallet, tokens, req.body.message, req.body.bh);
  res.json(result);
});

app.post("/transfer", async (req, res) => {
  let result = await staking.doTransfer(req.body.source, req.body.destination, req.body.amount, req.body.message, req.body.bh);
  res.json(result);
});

app.get("/job/handle-transfers", async (req, res) => {
  const job = require('./jobs/handle-transfers');
  let result = await job.run();
  res.json(result);
});

app.get("/job/handle-quests", async (req, res) => {
  const job = require('./jobs/handle-quests');
  let result = await job.run();
  res.json(result);
});

app.get("/job/grims-in-wallets", async (req, res) => {
  const job = require('./jobs/grims-in-wallets');
  let result = await job.run(req.query.num);
  res.json(result);
});

app.get("/job/sol-price", async (req, res) => {
  const job = require('./jobs/sol-price');
  let result = await job.run();
  res.json(result);
});

app.get("/int", async (req, res) => {
  let result = await staking.doInternal();
  res.json(result);
});

app.get("/remove-penalty", async (req, res) => {
  let result = await staking.doRemovePenalty(req.query.wallet);
  res.json(result);
});

app.get("/remove-penalties", async (req, res) => {
  let result = await staking.doRemovePenalties();
  res.json(result);
});

app.get("/fill-stamina", async (req, res) => {
  let result = await staking.doFillStamina(req.query.wallet);
  res.json(result);
});

app.use(express.static('public'));

// Start the server
const PORT = process.env.PORT || 5050;

const main = async () => {
  await mongoose
  const server = app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`);
    console.log('Press Ctrl+C to quit.');
  });
  
  process.on('SIGTERM', shutDown);
  process.on('SIGINT', shutDown);
  
  function shutDown() {
    server.close(async () => {
        console.log('\nShutting down DB connection...');
        await dbDisconnect();
        console.log('Done');
        process.exit(0);
    });
  }
}

main()