import { octasToUnit, unitToOctas, readConfig, parseAccount, getNodeUrl } from "../common";
import { SwapClient } from "./swap";
import { RouterClient } from "./router";
import { getAmountIn, getAmountOut, getLiquidity, getMintXY, getFee, getBurnXY } from "./utils";
import { CoinClient } from "../client";
import { AptosAccount } from "aptos";
import { readContract, writeContract } from "../utils/resource";

let config = readConfig();
let network = process.argv[2];
console.log("network", network);
let nodeUrl = getNodeUrl(network);
let hwswapAccount = parseAccount(config, "hwswap");
let coinAccount = parseAccount(config, "default");
console.log("nodeUrl", nodeUrl);
console.log("account", `${hwswapAccount.address()}`);
console.log("----------------------------");

const slippage = 2;
let routerClient = new RouterClient(nodeUrl, hwswapAccount);
let swapClient = new SwapClient(nodeUrl, hwswapAccount);

let harwCoin = "0x815401357d501dc73b084399f692f942eec25a2fc9f2795cb073a3df6330626f::HARW::T";
let usdcCoin = "0x815401357d501dc73b084399f692f942eec25a2fc9f2795cb073a3df6330626f::USDC::T";

async function main() {
    await deploy();
    // await verify();
}
async function deploy() {
    await swapClient.initialize();
    let contracts = readContract(network, "hwswap");
    contracts["swap"] = `${hwswapAccount.address()}::swap`;
    contracts["router"] = `${hwswapAccount.address()}::router`;
    writeContract(network, "hwswap", contracts);
}
async function verify() {
    let user = parseAccount(config, "bob");

    await verifyAddLiquidity(user, harwCoin, usdcCoin, unitToOctas(0.4), unitToOctas(0.3));
    await verifyAddLiquidity(user, usdcCoin, harwCoin, unitToOctas(0.4), unitToOctas(0.3));

    await verifyRemoveLiquidity(user, usdcCoin, harwCoin, unitToOctas(0.04));
    await verifyRemoveLiquidity(user, harwCoin, usdcCoin, unitToOctas(0.04));

    await verifySwapExactInput(user, harwCoin, usdcCoin, unitToOctas(0.002));
    await verifySwapExactInput(user, usdcCoin, harwCoin, unitToOctas(0.02));

    await verifySwapExactOutput(user, harwCoin, usdcCoin, unitToOctas(0.002));
    await verifySwapExactOutput(user, usdcCoin, harwCoin, unitToOctas(0.002));
}

async function verifySwapExactOutput(user: AptosAccount, coinX: string, coinY: string, yOut: number) {
    console.log("---------verifySwapExactOutput-----------");
    let xClient = new CoinClient(nodeUrl, coinX);
    let yClient = new CoinClient(nodeUrl, coinY);
    let { reserveX, reserveY } = await swapClient.queryTokenPair(coinX, coinY);

    console.log("reserveX", "reserveY", reserveX, reserveY);

    let xIn = getAmountIn(yOut, reserveX, reserveY);
    let xMaxIn = xIn + Math.trunc((xIn * slippage) / 100);
    console.log("yOut,xIn,xMaxIn", yOut, xIn, xMaxIn);

    const xBalance1 = await xClient.getBalance(user.address());
    const yBalance1 = await yClient.getBalance(user.address());
    console.log("balance: x,y", xBalance1, yBalance1);

    await routerClient.swapExactOutput(user, coinX, coinY, yOut, xMaxIn);

    const xBalance2 = await xClient.getBalance(user.address());
    const yBalance2 = await yClient.getBalance(user.address());
    console.log("balance: x,y", xBalance2, yBalance2);
    console.log("x-diff", xBalance1 - xBalance2);
    console.log("y-diff", yBalance2 - yBalance1);
}

async function verifySwapExactInput(user: AptosAccount, coinX: string, coinY: string, xExactIn: number) {
    console.log("---------verifySwapExactInput-----------");
    let xClient = new CoinClient(nodeUrl, coinX);
    let yClient = new CoinClient(nodeUrl, coinY);

    let { reserveX, reserveY } = await swapClient.queryTokenPair(coinX, coinY);

    console.log("reserveX", "reserveY", reserveX, reserveY);
    let yOut = getAmountOut(xExactIn, reserveX, reserveY);
    let minYOut = yOut - Math.trunc((yOut * slippage) / 100);

    console.log("xExactIn,yOut,minYout", xExactIn, yOut, minYOut);

    const xBalance1 = await xClient.getBalance(user.address());
    const yBalance1 = await yClient.getBalance(user.address());

    console.log("swap before, balance: x,y", octasToUnit(xBalance1), octasToUnit(yBalance1));

    await routerClient.swapExactInput(user, coinX, coinY, xExactIn, minYOut);

    const xBalance2 = await xClient.getBalance(user.address());
    const yBalance2 = await yClient.getBalance(user.address());
    console.log("swap after, balance: x,y", octasToUnit(xBalance2), octasToUnit(yBalance2));
    console.log("x-diff", octasToUnit(xBalance1 - xBalance2));
    console.log("y-diff", octasToUnit(yBalance2 - yBalance1));
}

async function verifyRemoveLiquidity(user: AptosAccount, coinX: string, coinY: string, amount: number) {
    console.log("----------verifyRemoveLiquidity----------");
    let pair = await swapClient.queryTokenPair(coinX, coinY);
    console.log("meta", pair);
    console.log("lp balance", await swapClient.queryLpBalance(coinX, coinY, user.address()));
    const lpCoinInfo = await swapClient.queryLpInfo(coinX, coinY);
    console.log("lpInfo", lpCoinInfo);

    let [amountX, amountY] = getBurnXY(coinX, coinY, pair.balanceX, pair.balanceY, lpCoinInfo.supply, amount);

    console.log("amountX", amountX);
    console.log("amountY", amountY);
    let fee = getFee(coinX, coinY, pair.reserveX, pair.reserveY, pair.kLast, lpCoinInfo.supply);
    console.log("fee", fee);
    await routerClient.removeLiquidity(user, coinX, coinY, amount, 0, 0);
    const lpCoinInfo2 = await swapClient.queryLpInfo(coinX, coinY);
    console.log("lpInfo2", lpCoinInfo2);
    console.log("lp balance", await swapClient.queryLpBalance(coinX, coinY, user.address()));
}
async function verifyAddLiquidity(user: AptosAccount, coinX: string, coinY: string, amountX: number, amountY: number) {
    console.log("----------verifyAddLiquidity----------");
    let pair = await swapClient.queryTokenPair(coinX, coinY);
    console.log("meta", pair);

    const lpCoinInfo = await swapClient.queryLpInfo(coinX, coinY);
    console.log("lpInfo", lpCoinInfo);

    let liquidity = getLiquidity(coinX, coinY, pair.reserveX, pair.reserveY, amountX, amountY, lpCoinInfo.supply);
    console.log("liquiidy", liquidity);
    let fee = getFee(coinX, coinY, pair.reserveX, pair.reserveY, pair.kLast, lpCoinInfo.supply);
    console.log("fee", fee);

    let [mintX, mintY] = getMintXY(coinX, coinY, pair.reserveX, pair.reserveY, amountX, amountY);
    console.log("mintX", mintX);
    console.log("mintY", mintY);
    await routerClient.addLiquidity(user, coinX, coinY, amountX, amountY, 0, 0);

    const lpCoinInfo2 = await swapClient.queryLpInfo(coinX, coinY);
    console.log("lpInfo2", lpCoinInfo2);
    console.log("lp balance", await swapClient.queryLpBalance(coinX, coinY, user.address()));
}

if (require.main === module) {
    main().catch((e) => console.error(e));
}
