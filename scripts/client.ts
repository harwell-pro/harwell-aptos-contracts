import { AptosAccount, AptosClient, MaybeHexString, HexString, TokenClient } from "aptos";
import assert from "assert";
import fetch from "cross-fetch";

function showTransactionDetail(prefix: string, transaction: any) {
    console.log(prefix, { hash: transaction.hash, success: transaction.success, message: transaction.vm_status });
}

async function submitAndConfirmPayload(
    aptosClient: AptosClient,
    userAccount: AptosAccount,
    payload: any,
    showTransaction = false
): Promise<any> {
    //console.log("submitAndConfirmPayload", payload);
    const rawTxn = await aptosClient.generateTransaction(userAccount.address(), payload);
    const bcsTxn = await aptosClient.signTransaction(userAccount, rawTxn);
    const pendingTxn = await aptosClient.submitTransaction(bcsTxn);
    let result = await aptosClient.waitForTransactionWithResult(pendingTxn.hash, { checkSuccess: true });
    if (showTransaction) {
        showTransactionDetail(payload.function, result);
    }
    return result;
}
async function queryTableItem(
    nodeUrl: string,
    tableHandler: string,
    keyType: string,
    valueType: string,
    key: any
): Promise<any> {
    let url = `${nodeUrl}/tables/${tableHandler}/item`;
    let data = { key_type: keyType, value_type: valueType, key };
    let headers = { "Content-Type": "application/json" };
    //console.log("queryTableItem", url, data);
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(data) });
    if (response.status == 200) {
        return await response.json();
    } else {
        return null;
    }
}

async function getTransaction(nodeUrl: string, hash: string): Promise<any> {
    let url = `${nodeUrl}/transactions/${hash}`;
    //console.log("getTransaction: ", url);
    const response = await fetch(url, { method: "GET" });
    if (response.status == 404) {
        //throw new Error(`Waiting for transaction ${hash} error, invalid url`);
        return { type: "pending_transaction" };
    }
    if (response.status != 200) {
        assert(response.status == 200, await response.text());
    }
    return await response.json();
}

async function queryResource(nodeUrl: string, userAddress: MaybeHexString, resourceType: string): Promise<any> {
    let url = `${nodeUrl}/accounts/${userAddress}/resource/${resourceType}`;
    // console.log("queryResource", url);
    const response = await fetch(url, { method: "GET" });
    if (response.status == 404) {
        return null;
    }
    if (response.status != 200) {
        assert(response.status == 200, await response.text());
    }
    return await response.json();
}

async function queryModules(nodeUrl: string, moduleAddress: MaybeHexString): Promise<Array<any>> {
    let url = `${nodeUrl}/accounts/${moduleAddress}/modules`;
    console.log("queryModules: ", url);
    const response = await fetch(url, { method: "GET" });
    if (response.status == 404) {
        return [];
    }
    if (response.status != 200) {
        assert(response.status == 200, await response.text());
    }
    return await response.json();
}

export class BaseClient extends AptosClient {
    moduleName: string;
    deployer: AptosAccount;
    moduleType: string;
    moduleAddress: HexString;

    constructor(nodeUrl: string, deployer: AptosAccount, moduleName: string) {
        super(nodeUrl);
        this.moduleName = moduleName;
        this.deployer = deployer;
        this.moduleAddress = deployer.address();
        this.moduleType = `${this.moduleAddress}::${this.moduleName}`;
    }

    async getTransaction(hash: string): Promise<any> {
        return await getTransaction(this.nodeUrl, hash);
    }

    async queryResource(userAddress: MaybeHexString, resourceType: string): Promise<any> {
        return await queryResource(this.nodeUrl, userAddress, resourceType);
    }

    async queryModules(moduleAddress: MaybeHexString): Promise<Array<any>> {
        return await queryModules(this.nodeUrl, moduleAddress);
    }

    async queryModuleResource(user: MaybeHexString, structName: string): Promise<any> {
        let resourceType = `${this.moduleType}::${structName}`;
        return await this.queryResource(user, resourceType);
    }

    async queryTableItem(tableHandler: string, keyType: string, valueType: string, key: any): Promise<any> {
        return await queryTableItem(this.nodeUrl, tableHandler, keyType, valueType, key);
    }

    async submitAndConfirmPayload(userAccount: AptosAccount, payload: any, showTransaction = false): Promise<any> {
        return await submitAndConfirmPayload(this, userAccount, payload, showTransaction);
    }

    showTransaction(prefix: string, transaction: any) {
        showTransactionDetail(prefix, transaction);
    }
}

export class CoinInfo {
    name: string;
    symbol: string;
    decimals: number;
    supply: number;

    constructor(name: string, symbol: string, decimals: number, supply: number) {
        this.decimals = decimals;
        this.name = name;
        this.supply = supply;
        this.symbol = symbol;
    }
}

export class CoinClient extends AptosClient {
    coinType: String;

    constructor(nodeUrl: string, coinType: string) {
        super(nodeUrl);
        this.coinType = coinType;
    }

    async isRegistered(accountAddress: MaybeHexString): Promise<boolean> {
        let resourceType = `0x1::coin::CoinStore<${this.coinType}>`;
        let resource = await queryResource(this.nodeUrl, accountAddress, resourceType);
        return resource && resource.type == resourceType;
    }

    async register(userAccount: AptosAccount): Promise<any> {
        return submitAndConfirmPayload(
            this,
            userAccount,
            {
                function: "0x1::managed_coin::register",
                type_arguments: [this.coinType],
                arguments: [],
            },
            true
        );
    }

    async mint(minter: AptosAccount, user: any, amount: number | bigint): Promise<any> {
        return submitAndConfirmPayload(
            this,
            minter,
            {
                function: "0x1::managed_coin::mint",
                type_arguments: [this.coinType],
                arguments: [`${user}`, amount],
            },
            true
        );
    }
    async getBalance(accountAddress: MaybeHexString): Promise<number> {
        try {
            let resourceType = `0x1::coin::CoinStore<${this.coinType}>`;
            const resource = await queryResource(this.nodeUrl, accountAddress, resourceType);
            if (resource) {
                return parseInt((resource.data as any)["coin"]["value"]);
            }
        } catch (_) {}
        return 0;
    }
    async queryInfo(owner: MaybeHexString): Promise<any> {
        let type = `0x1::coin::CoinInfo<${this.coinType}>`;
        let resource = await queryResource(this.nodeUrl, `${owner}`, type);
        if (resource) {
            let { decimals, name, supply, symbol } = resource.data;
            let supplyValue = 0;
            try {
                supplyValue = +supply.vec[0].integer.vec[0].value;
            } catch (e) {}
            return new CoinInfo(name, symbol, +decimals, supplyValue);
        }
        return new CoinInfo("", "", 0, 0);
    }
}
