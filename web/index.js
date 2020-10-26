import { getSigner, getDispenser, getErc20, displayFeedback, wrapListener } from './common/utils.js';
import { ROOT_CHAIN_ID } from './config.js';

const defaultProvider = ethers.getDefaultProvider(ROOT_CHAIN_ID);

async function setupTokenlist () {
  const src = 'https://gateway.ipfs.io/ipns/tokens.uniswap.org';
  const { tokens } = await (await fetch(src)).json();
  const datalist = document.createElement('datalist');

  for (const token of tokens) {
    if (token.chainId !== ROOT_CHAIN_ID) {
      continue;
    }

    const opt = document.createElement('option');
    opt.value = `${token.name} (${token.symbol}) ${token.address}`;
    datalist.appendChild(opt);
  }

  datalist.id = 'tokenlist';
  document.body.appendChild(datalist);
}

async function deploy (evt) {
  const signer = await getSigner();
  const elements = document.querySelectorAll('input');
  const config = {};

  for (const ele of elements) {
    config[ele.id] = ele.value;
  }

  const token = ethers.utils.getAddress(config.token.split(' ').pop());
  const tokenAddress = await defaultProvider.resolveName(token);
  const erc20 = await getErc20(tokenAddress);
  const decimals = await erc20.decimals();
  const payees = []
  const ratesPerHour = [];
  const table = document.querySelector('.grid');

  for (const v of table.querySelectorAll('p.payee')) {
    payees.push(v.textContent);
  }

  for (const v of document.querySelectorAll('p.rate')) {
    const value = ethers.utils.parseUnits(v.textContent, decimals);
    ratesPerHour.push(value.toString());
  }

  const payer = await defaultProvider.resolveName(config.payer);
  const startTime = ~~(Date.parse(config.startTime) / 1000);

  if (!token) {
    throw new Error('invalid token');
  }

  if (!payer) {
    throw new Error('invalid payer');
  }

  if (!startTime) {
    throw new Error('invalid date');
  }

  const args = [tokenAddress, payer, startTime, payees, ratesPerHour];
  const dispenser = (await getDispenser()).connect(signer);
  const tx = await dispenser.create(...args);

  await displayFeedback('Creating Contract', evt.target, tx);

  const receipt = await tx.wait();
  const contractAddress = receipt.events[0].args[0];
  window.location.href = `/overview/#${contractAddress}`;
}

async function datetime (evt) {
  const date = new Date();
  document.querySelector('input#startTime').value =
    `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
}

async function addPayee (evt) {
  const payeeInput = document.querySelector('input#payee');
  const rateInput = document.querySelector('input#ratePerHour');
  const a = await defaultProvider.resolveName(payeeInput.value);
  const b = Number(rateInput.value);

  if (!a) {
    throw new Error(`invalid address: ${payeeInput.value}`);
  }

  if (!b) {
    throw new Error('invalid hourly rate');
  }

  const container = document.querySelector('.grid');
  const addr = document.createElement('p');
  const rate = document.createElement('p');

  addr.className = 'payee';
  rate.className = 'rate';
  addr.textContent = a;
  rate.textContent = b;

  container.appendChild(addr);
  container.appendChild(rate);

  payeeInput.value = '';
  rateInput.value = '';
}

async function payerAutofill (evt) {
  const signer = await getSigner();

  document.querySelector('input#payer').value = await signer.getAddress();
}

async function render () {
  setupTokenlist();

  wrapListener('button#deploy', deploy);
  wrapListener('button#add', addPayee);
  wrapListener('button#datetime', datetime);
  wrapListener('button#payerAutofill', payerAutofill);
}

window.addEventListener('DOMContentLoaded', render, false);
