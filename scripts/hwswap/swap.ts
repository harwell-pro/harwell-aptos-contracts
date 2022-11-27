import { BaseClient, CoinClient, CoinInfo } from "../client";
import { AptosAccount, MaybeHexString } from "aptos";
import { sortCoin } from "./utils";

export class TokenPair {
    reserveX: number;
    reserveY: number;
    balanceX: number;
    balanceY: number;
    feeAmount: number;
    kLast: number;
    blockTimestampLast: number;

    constructor(
        reserveX: number,
        reserveY: number,
        balanceX: number,
        balanceY: number,
        feeAmount: number,
        kLast: number,
        blockTimestampLast: number
    ) {
        this.reserveX = reserveX;
        this.reserveY = reserveY;
        this.balanceX = balanceX;
        this.balanceY = balanceY;
        this.feeAmount = feeAmount;
        this.kLast = kLast;
        this.blockTimestampLast = blockTimestampLast;
    }
}

export class SwapClient extends BaseClient {
    constructor(nodeUrl: string, deployer: AptosAccount) {
        super(nodeUrl, deployer, "swap");
    }

    getLpType(coinX: string, coinY: string): string {
        let [x, y] = coinX < coinY ? [coinX, coinY] : [coinY, coinX];
        return `${this.deployer.address()}::swap::LPToken<${x}, ${y}>`;
    }

    async queryLpInfo(coinX: string, coinY: string): Promise<CoinInfo> {
        let coinClient = new CoinClient(this.nodeUrl, this.getLpType(coinX, coinY));
        return await coinClient.queryInfo(this.deployer.address());
    }

    async queryLpBalance(coinX: string, coinY: string, account: MaybeHexString): Promise<number> {
        let coinClient = new CoinClient(this.nodeUrl, this.getLpType(coinX, coinY));
        return await coinClient.getBalance(account);
    }

    async querySwapInfo(): Promise<any> {
        let result = await this.queryModuleResource(this.deployer.address(), `SwapInfo`);
        return result && result.data;
    }

    async initialize() {
        if (await this.querySwapInfo()) return;
        let payload = {
            type: "script_function_payload",
            function: `${this.moduleType}::initialize`,
            type_arguments: [],
            arguments: [],
        };
        console.log("initialize, payload: ", payload);
        await this.submitAndConfirmPayload(this.deployer, payload, true);
    }

    async queryTokenPairReserve(coinX: string, coinY: string): Promise<any> {
        let [x, y] = sortCoin(coinX, coinY);
        let structName = `TokenPairReserve<${x},${y}>`;
        let result = await this.queryModuleResource(this.deployer.address(), structName);
        return result && result.data;
    }

    async queryTokenPairMetadata(coinX: string, coinY: string): Promise<any> {
        let [x, y] = sortCoin(coinX, coinY);
        let structName = `TokenPairMetadata<${x},${y}>`;
        let result = await this.queryModuleResource(this.deployer.address(), structName);
        return result && result.data;
    }

    async queryTokenPair(coinX: string, coinY: string): Promise<TokenPair> {
        let reserves = await this.queryTokenPairReserve(coinX, coinY);
        let metadata = await this.queryTokenPairMetadata(coinX, coinY);
        // console.log(metadata);
        // console.log(reserves);
        if (reserves && reserves) {
            if (coinX < coinY) {
                return new TokenPair(
                    +reserves.reserve_x,
                    +reserves.reserve_y,
                    +metadata.balance_x.value,
                    +metadata.balance_y.value,
                    +metadata.fee_amount.value,
                    +metadata.k_last,
                    +reserves.block_timestamp_last
                );
            } else {
                return new TokenPair(
                    +reserves.reserve_y,
                    +reserves.reserve_x,
                    +metadata.balance_y.value,
                    +metadata.balance_x.value,
                    +metadata.fee_amount.value,
                    +metadata.k_last,
                    +reserves.block_timestamp_last
                );
            }
        }
        return new TokenPair(0, 0, 0, 0, 0, 0, 0);
    }
}
