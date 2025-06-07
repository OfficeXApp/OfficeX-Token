import { ArrowRightOutlined, SyncOutlined } from "@ant-design/icons";

import {
  Alert,
  Button,
  Card,
  Divider,
  Input,
  notification,
  Steps,
  Typography,
} from "antd";
import WalletSection from "./WalletSection";
import { useState } from "react";
import {
  ANCIENT_BASE_TOKEN,
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
              tokenInfo.ancient
                ? parseFloat(tokenInfo.ancient.balance).toFixed(4)
                : "0"
            } ancient tokens`}
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Card
          size="small"
          style={{ backgroundColor: "#f9f0ff", marginBottom: 24 }}
        >
          <Title level={4}>Migration Process</Title>
          <Steps
            size="small"
            items={[
              {
                title: "Approve Token",
                description: "Allow the contract to spend your ancient tokens",
              },
              {
                title: "Migrate",
                description: "Convert ancient tokens to wrapped tokens 1:1",
              },
              {
                title: "Use Bridge",
                description: "Use wrapped tokens for bridging operations",
              },
            ]}
          />
        </Card>

        <div>
          <div style={{ marginBottom: 16 }}>
            <Text strong>Amount (Ancient Base Tokens)</Text>
            <Input
              placeholder="0.0"
              suffix={tokenInfo.ancient?.symbol || "ANCIENT-BASE"}
              size="large"
              style={{ marginTop: 8 }}
              value={migrateForm.amount}
              onChange={(e) => setMigrateForm({ amount: e.target.value })}
              disabled={!wallet.isConnected}
            />
            {wallet.isConnected && tokenInfo.ancient && (
              <Button
                type="link"
                size="small"
                onClick={() =>
                  setMigrateForm({ amount: tokenInfo.ancient!.balance })
                }
              >
                Use max balance
              </Button>
            )}
          </div>

          <Alert
            message="1:1 Exchange Rate"
            description="You will receive the same amount of wrapped Base tokens as ancient tokens you migrate."
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

        <Divider />

        <Card size="small" style={{ backgroundColor: "#fff7e6" }}>
          <Title level={5}>After Migration</Title>
          <Paragraph>
            Once you have wrapped Base tokens, you can use the "Bridge to
            Solana" tab to bridge your tokens to other chains.
          </Paragraph>
          <Button type="link" onClick={() => setActiveTab("2")}>
            Go to Bridge to Solana <ArrowRightOutlined />
          </Button>
        </Card>
      </Card>
    </div>
  );
};

export default MigrateAncientTab;
