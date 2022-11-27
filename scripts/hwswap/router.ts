import { BaseClient } from "../client";
import { AptosAccount } from "aptos";

export class RouterClient extends BaseClient {
    constructor(nodeUrl: string, deployer: AptosAccount) {
        super(nodeUrl, deployer, "router");
    }

    async addLiquidity(
        user: AptosAccount,
        coinX: string,
        coinY: string,
        amountXDesired: number,
        amountYDesired: number,
        amountXMin: number,
        amountYMin: number
    ) {
        let payload = {
            type: "script_function_payload",
            function: `${this.moduleType}::add_liquidity`,
            type_arguments: [coinX, coinY],
            arguments: [amountXDesired, amountYDesired, amountXMin, amountYMin],
        };
        await this.submitAndConfirmPayload(user, payload, true);
    }

    async removeLiquidity(
        user: AptosAccount,
        coinX: string,
        coinY: string,
        liquidity: number,
        amountXMin: number,
        amountYMin: number
    ) {
        let payload = {
            type: "script_function_payload",
            function: `${this.moduleType}::remove_liquidity`,
            type_arguments: [coinX, coinY],
            arguments: [liquidity, amountXMin, amountYMin],
        };
        await this.submitAndConfirmPayload(user, payload, true);
    }

    async swapExactInput(user: AptosAccount, coinX: string, coinY: string, xIn: number, yMinOut: number) {
        let payload = {
            type: "script_function_payload",
            function: `${this.moduleType}::swap_exact_input`,
            type_arguments: [coinX, coinY],
            arguments: [xIn, yMinOut],
        };
        await this.submitAndConfirmPayload(user, payload, true);
    }

    async swapExactOutput(user: AptosAccount, coinX: string, coinY: string, yOut: number, xMaxIn: number) {
        let payload = {
            type: "script_function_payload",
            function: `${this.moduleType}::swap_exact_output`,
            type_arguments: [coinX, coinY],
            arguments: [yOut, xMaxIn],
        };
        await this.submitAndConfirmPayload(user, payload, true);
    }
}
