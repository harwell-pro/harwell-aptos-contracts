import { readConfig, parseAccount, getNodeUrl, unitToOctas } from "../common";
import { AptosAccount, MaybeHexString } from "aptos";
import { BaseClient, CoinClient } from "../client";
import { readContract, writeContract } from "../utils/resource";

interface SimpleKeyValueObject {
    [key: string]: any;
}

let module_name = "grade_008";

let config = readConfig();
let network = process.argv[2];
let nodeUrl = getNodeUrl(network);
let deployer = parseAccount(config, "default");
let bob = parseAccount(config, "bob");
let harwCoin = `${deployer.address()}::HARW::T`;
console.log("nodeUrl", nodeUrl);
console.log("----------------------------");

class GradeClient extends BaseClient {
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
        let weights = levels.map((item) => unitToOctas(item.weight));
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

async function mint(client: CoinClient, user: AptosAccount, amount: number) {
    if (!(await client.isRegistered(user.address()))) {
        await client.register(user);
    }
    await client.mint(deployer, user.address(), amount);
}

async function main() {
    const client = new GradeClient();
    await deploy(client);
    //await verify(client);
}
async function deploy(client: GradeClient) {
    await client.initialize();
    let moduleStore = await client.queryModuleStore();
    if (moduleStore) {
        let { levels, lock_unit_span, signer_capability } = moduleStore.data;
        console.log("moduleStore", moduleStore);
        let contracts = readContract(network, "ido");
        contracts.grade = {
            address: `${deployer.address()}::${module_name}`,
            levels,
            lock_unit_span,
            signer_capability,
        };
        writeContract(network, "ido", contracts);
    }
}
async function verify(client: GradeClient) {
    let user = bob;
    let harwClient = new CoinClient(nodeUrl, harwCoin);
    if (network != "mainnet") {
        let balance = await harwClient.getBalance(user.address());
        if (balance < unitToOctas(1000000)) {
            await mint(harwClient, user, unitToOctas(10000000));
        }
    }

    let balance1 = await harwClient.getBalance(user.address());
    console.log("balance1", balance1);

    await verifyDeposit(client, user);
    await verifyWithdraw(client, user);
    let balance2 = await harwClient.getBalance(user.address());
    console.log("balance2", balance2);
}

async function verifyDeposit(client: GradeClient, user: AptosAccount) {
    await client.deposit(user, unitToOctas(7007), 1);
    await client.deposit(user, unitToOctas(887000), 1);
    await client.deposit(user, unitToOctas(29000), 1);
}

async function verifyWithdraw(client: GradeClient, user: AptosAccount) {
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
