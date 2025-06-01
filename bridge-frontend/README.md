# Bridge OfficeX Base to Solana

## Usage Instructions

Users will manually deposit their tokens to the bridge vault on Base and wait for the transaction to be confirmed.
Admin will then manually confirm the deposit and manually release the tokens to the user's Solana wallet.

Admin must:

1. Get the depositID from basescan `depositCounter` and check against `deposits` to return struct `Deposit` below. Specifically admin needs `Deposit.amount` and `Deposit.receivingWalletAddress`.

```solidity
struct Deposit {
    uint256 depositId;
    address depositor;
    uint256 amount;
    string receivingWalletAddress;
    DepositStatus status;
    string txFinal;
}
```

2. Lock the deposit via basescan `lockDeposit`
3. Manually transfer Solana tokens to the receiving wallet address, making sure to account for decimals (18 on base, 9 on Solana) ⚠️ DANGER ⚠️ Be very careful
4. Burn the deposit via basescan `burnDeposit`
5. The deposit will automatically be marked as completed on frontend. If the user provided their email, send them a notification via email.

## Deploy the frontend

Deploy the frontend:

```
$ npm run build && firebase deploy --project bridge-officex
```
