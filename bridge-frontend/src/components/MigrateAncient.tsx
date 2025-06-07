import { ArrowRightOutlined, SyncOutlined } from "@ant-design/icons";

import {
  Alert,
  Button,
  Card,
  Divider,
  Input,
  notification,
  Steps,
  Tabs,
  Typography,
} from "antd";
import WalletSection from "./WalletSection";
import { useEffect, useState } from "react";
import {
  ANCIENT_BASE_TOKEN,
  BASE_TOKEN,
  BRIDGE_BASE_CONTRACT_ADDRESS,
  BRIDGE_VAULT_ABI,
  ERC20_ABI,
  type TokenInfo,
  type WalletState,
} from "../constants";
import {
  createPublicClient,
  createWalletClient,
  custom,
  getContract,
  http,
  parseEther,
} from "viem";
import { base } from "viem/chains";

const { Title, Paragraph, Text } = Typography;

interface MigrateFormData {
  amount: string;
}

const MigrateAncientTab = ({
  wallet,
  setWallet,
  fetchTokenInfo,
  tokenInfo,
  setActiveTab,
  bridgeInventory,
}: {
  wallet: WalletState;
  setWallet: (wallet: WalletState) => void;
  fetchTokenInfo: () => void;
  tokenInfo: {
    base: TokenInfo | null;
    ancient: TokenInfo | null;
  };
  setActiveTab: (tab: string) => void;
  bridgeInventory: string;
}) => {
  const [loading, setLoading] = useState(false);

  const [migrateForm, setMigrateForm] = useState<MigrateFormData>({
    amount: "",
  });

  const [unwrapEnabled, setUnwrapEnabled] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState("wrap");
  const [unwrapForm, setUnwrapForm] = useState<MigrateFormData>({
    amount: "",
  });

  useEffect(() => {
    const checkUnwrapEnabled = async () => {
      try {
        const bridgeContract = getContract({
          address: BRIDGE_BASE_CONTRACT_ADDRESS as `0x${string}`,
          abi: BRIDGE_VAULT_ABI,
          client: publicClient,
        });

        const enabled = await bridgeContract.read.unwrapEnabled();
        setUnwrapEnabled(enabled as boolean);
      } catch (error) {
        console.error("Failed to check unwrap status:", error);
      }
    };

    if (wallet.isConnected) {
      checkUnwrapEnabled();
    }
  }, [wallet.isConnected]);

  // Viem clients
  const publicClient = createPublicClient({
    chain: base,
    transport: http(
      "https://base-mainnet.g.alchemy.com/v2/EAF1m-3-59-iXzmNbA99cvWq9pFovfxu"
    ),
  });

  const getWalletClient = () => {
    if (typeof window !== "undefined" && window.ethereum) {
      return createWalletClient({
        chain: base,
        transport: custom(window.ethereum),
      });
    }
    return null;
  };

  // Approve token spending
  const approveToken = async (tokenAddress: string, amount: string) => {
    const walletClient = getWalletClient();
    if (!walletClient || !wallet.isConnected) return false;

    try {
      setLoading(true);

      const hash = await walletClient.writeContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [BRIDGE_BASE_CONTRACT_ADDRESS, parseEther(amount)],
        account: wallet.address as `0x${string}`,
      });

      await publicClient.waitForTransactionReceipt({ hash });

      notification.success({
        message: "Approval Successful",
        description: "Token spending approved",
      });

      return true;
    } catch (error) {
      console.error("Approval failed:", error);
      notification.error({
        message: "Approval Failed",
        description: "Failed to approve token spending",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Migrate ancient tokens
  const handleMigrateAncient = async () => {
    const walletClient = getWalletClient();
    if (!walletClient || !wallet.isConnected) return;

    if (!migrateForm.amount) {
      notification.error({
        message: "Invalid Input",
        description: "Please enter an amount",
      });
      return;
    }

    try {
      setLoading(true);

      // First approve the ancient token spending
      const approved = await approveToken(
        ANCIENT_BASE_TOKEN,
        migrateForm.amount
      );
      if (!approved) return;

      // Then call the migration function
      const hash = await walletClient.writeContract({
        address: BRIDGE_BASE_CONTRACT_ADDRESS as `0x${string}`,
        abi: BRIDGE_VAULT_ABI,
        functionName: "wrapAncientForToken",
        args: [parseEther(migrateForm.amount)],
        account: wallet.address as `0x${string}`,
      });

      await publicClient.waitForTransactionReceipt({ hash });

      notification.success({
        message: "Migration Successful",
        description: "Your ancient tokens have been migrated to wrapped tokens",
      });

      setMigrateForm({ amount: "" });
      fetchTokenInfo(); // Refresh balances
    } catch (error) {
      console.error("Migration failed:", error);
      notification.error({
        message: "Migration Failed",
        description: "Failed to migrate ancient tokens",
      });
    } finally {
      setLoading(false);
    }
  };

  // Add this function after handleMigrateAncient
  const handleUnwrapToken = async () => {
    const walletClient = getWalletClient();
    if (!walletClient || !wallet.isConnected) return;

    if (!unwrapForm.amount) {
      notification.error({
        message: "Invalid Input",
        description: "Please enter an amount",
      });
      return;
    }

    try {
      setLoading(true);

      // First approve the wrapped token spending
      const approved = await approveToken(BASE_TOKEN, unwrapForm.amount);
      if (!approved) return;

      // Then call the unwrap function
      const hash = await walletClient.writeContract({
        address: BRIDGE_BASE_CONTRACT_ADDRESS as `0x${string}`,
        abi: BRIDGE_VAULT_ABI,
        functionName: "unwrapTokenForAncient",
        args: [parseEther(unwrapForm.amount)],
        account: wallet.address as `0x${string}`,
      });

      await publicClient.waitForTransactionReceipt({ hash });

      notification.success({
        message: "Unwrap Successful",
        description:
          "Your wrapped tokens have been converted back to ancient tokens",
      });

      setUnwrapForm({ amount: "" });
      fetchTokenInfo(); // Refresh balances
    } catch (error) {
      console.error("Unwrap failed:", error);
      notification.error({
        message: "Unwrap Failed",
        description: "Failed to unwrap tokens",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <WalletSection
        wallet={wallet}
        setWallet={setWallet}
        tokenInfo={tokenInfo}
        bridgeInventory={bridgeInventory}
      />

      <Card>
        <Title level={2}>
          <SyncOutlined style={{ color: "#722ed1", marginRight: 8 }} />
          Migrate Ancient Token
        </Title>
        {!wallet.isConnected ? (
          <Alert
            message="Wallet Not Connected"
            description="Please connect your MetaMask wallet to continue"
            type="warning"
            showIcon
            style={{ marginBottom: 24 }}
          />
        ) : (
          <Alert
            message="Token Migration"
            description={`Convert your old ${
              tokenInfo.ancient?.symbol || "Ancient"
            } tokens to wrapped ${
              tokenInfo.base?.symbol || "Base"
            } tokens. Available: ${
              tokenInfo.ancient ? tokenInfo.ancient.balance : "0"
            } ancient tokens`}
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Tabs activeKey={activeSubTab} onChange={setActiveSubTab} type="card">
          <Tabs.TabPane
            tab={
              <span>
                <SyncOutlined />
                Wrap Ancient
              </span>
            }
            key="wrap"
          >
            <div>
              <div style={{ marginBottom: 16 }}>
                <Text strong>Amount (Ancient Base Tokens)</Text>
                <Input
                  placeholder="0.0"
                  suffix={
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0, height: "auto", fontSize: 12 }}
                        onClick={() =>
                          setMigrateForm({
                            amount:
                              tokenInfo.ancient?.balance.replace(/,/g, "") ||
                              "0",
                          })
                        }
                        disabled={
                          !wallet.isConnected || !tokenInfo.ancient?.balance
                        }
                      >
                        MAX
                      </Button>
                      <span>{tokenInfo.ancient?.symbol || "ANCIENT-BASE"}</span>
                    </div>
                  }
                  size="large"
                  style={{ marginTop: 8 }}
                  value={migrateForm.amount}
                  onChange={(e) => setMigrateForm({ amount: e.target.value })}
                  disabled={!wallet.isConnected}
                />
              </div>

              <Alert
                message="1:1 Exchange Rate"
                description="You will receive the same amount of wrapped Base tokens as ancient tokens you migrate, minus any burn or tax applied by the token contract"
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Button
                type="primary"
                onClick={handleMigrateAncient}
                size="large"
                block
                icon={<SyncOutlined />}
                disabled={!wallet.isConnected}
                loading={loading}
              >
                Migrate to Wrapped Tokens
              </Button>
            </div>
          </Tabs.TabPane>

          <Tabs.TabPane
            tab={
              <span>
                <SyncOutlined />
                Unwrap to Ancient
              </span>
            }
            key="unwrap"
            disabled={!unwrapEnabled}
          >
            {!unwrapEnabled ? (
              <Alert
                message="Unwrapping Disabled"
                description="Unwrapping is currently disabled by the contract administrator."
                type="warning"
                showIcon
                style={{ marginBottom: 24 }}
              />
            ) : (
              <>
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <Text strong>Amount (Wrapped Base Tokens)</Text>
                    <Input
                      placeholder="0.0"
                      suffix={
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Button
                            type="link"
                            size="small"
                            style={{ padding: 0, height: "auto", fontSize: 12 }}
                            onClick={() =>
                              setUnwrapForm({
                                amount:
                                  tokenInfo.base?.balance.replace(/,/g, "") ||
                                  "0",
                              })
                            }
                            disabled={
                              !wallet.isConnected || !tokenInfo.base?.balance
                            }
                          >
                            MAX
                          </Button>
                          <span>{tokenInfo.base?.symbol || "WBASE"}</span>
                        </div>
                      }
                      size="large"
                      style={{ marginTop: 8 }}
                      value={unwrapForm.amount}
                      onChange={(e) =>
                        setUnwrapForm({ amount: e.target.value })
                      }
                      disabled={!wallet.isConnected}
                    />
                  </div>

                  <Alert
                    message="1:1 Exchange Rate"
                    description="You will receive the same amount of ancient tokens as wrapped tokens you unwrap."
                    type="success"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />

                  <Button
                    type="primary"
                    onClick={handleUnwrapToken}
                    size="large"
                    block
                    icon={<SyncOutlined />}
                    disabled={!wallet.isConnected || !unwrapEnabled}
                    loading={loading}
                  >
                    Unwrap to Ancient Tokens
                  </Button>
                </div>
              </>
            )}
          </Tabs.TabPane>
        </Tabs>
        <Divider />
      </Card>
    </div>
  );
};

export default MigrateAncientTab;
