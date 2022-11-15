import { readConfig, parseAccount } from "./common";
import { AptosAccount, MaybeHexString } from "aptos";
import { BaseClient, BaseCoinClient } from "./client";

interface SimpleKeyValueObject {
    [key: string]: any;
}

let module_name = "grade_006";
const GAS_UNIT = 1;
const APT = GAS_UNIT * 1e6;

function apt_to_gas_unit(n: number): number {
    return Math.trunc(n * APT);
}

let config = readConfig();
let network = process.argv[2];
console.log("profile", network);
let { rest_url: nodeUrl, private_key: privateKey, account } = config.profiles[network];
let deployer = parseAccount(config, network);
console.log("nodeUrl", nodeUrl);
console.log("privateKey", privateKey);
console.log("account", account);
console.log("----------------------------");

let bob = parseAccount(config, "bob");
let harwCoin = `${deployer.address()}::HARW::T`;

class AllowanceClient extends BaseClient {
    constructor() {
        super(nodeUrl, deployer, module_name);
    }

    async queryModuleStore(): Promise<any> {
        return await this.queryModuleResource(this.deployer.address(), `ModuleStore<${harwCoin}>`);
    }
    async queryUserStore(user: MaybeHexString): Promise<any> {
        return await this.queryModuleResource(user, `UserStore<${harwCoin}>`);
    }

    async isInitialized(): Promise<boolean> {
        let resource = await this.queryModuleStore();
        return resource != null;
    }

    async deposit(user: AptosAccount, amount: number, lockUnits: number) {
        let payload = {
            type: "script_function_payload",
            function: `${this.moduleType}::deposit`,
            type_arguments: [harwCoin],
            arguments: [amount, lockUnits],
        };
        await this.submitAndConfirmPayload(user, payload, true);
    }
    async withdraw(user: AptosAccount, sequence: number) {
        let payload = {
            type: "script_function_payload",
            function: `${this.moduleType}::withdraw`,
            type_arguments: [harwCoin],
            arguments: [sequence],
        };
        await this.submitAndConfirmPayload(user, payload, true);
    }

    async initialize() {
        if (await this.isInitialized()) return;
        const levels = [
            { name: "bronze", weight: 7000 },
            { name: "silver", weight: 20000 },
            { name: "gold", weight: 40000 },
            { name: "platinum", weight: 80000 },
            { name: "diamond", weight: 160000 },
        ];

        let lockUnitSpan = network == "mainnet" ? 3600 * 24 : 1;
        let names = levels.map((item) => [...Buffer.from(item.name, "utf-8")]);
        let weights = levels.map((item) => item.weight * APT);
        let payload = {
            type: "script_function_payload",
            function: `${this.moduleType}::initialize`,
            type_arguments: [harwCoin],
            arguments: [names, weights, lockUnitSpan, `${Date.now()}`],
        };
        console.log("initialize, payload: ", payload);
        await this.submitAndConfirmPayload(this.deployer, payload, true);
    }
}

async function mint(client: BaseCoinClient, user: AptosAccount, amount: number) {
    if (!(await client.isRegistered(user.address()))) {
        await client.register(deployer.address(), user);
    }
    await client.mint(deployer, user.address(), amount);
}

async function main() {
    const client = new AllowanceClient();
    await client.initialize();
    let user = bob;
    let harwClient = new BaseCoinClient(nodeUrl, deployer, "HARW");
    if (network != "mainnet") {
        //await mint(harwClient, user, APT * 10000000);
    }

    let balance1 = await harwClient.getBalance(user.address());
    console.log("balance1", balance1);

    await verifyDeposit(client, user);
    await verifyWithdraw(client, user);
    let balance2 = await harwClient.getBalance(user.address());
    console.log("balance2", balance2);
}

async function verifyDeposit(client: AllowanceClient, user: AptosAccount) {
    await client.deposit(user, 7000 * APT, 1);
    await client.deposit(user, 887000 * APT, 1);
    await client.deposit(user, 29000 * APT, 1);
}

async function verifyWithdraw(client: AllowanceClient, user: AptosAccount) {
    let userStore = await client.queryUserStore(user.address());
    if (userStore) {
        console.log("user-level", userStore.data.level);
        let depositions = userStore.data.depositions;
        //console.log(depositions);
        if (depositions.length > 0) {
            await client.withdraw(user, depositions.pop().sequence);
        }
    }
}

if (require.main === module) {
    main().catch((e) => console.error(e));
}
