import {
  InfoCircleOutlined,
  SwapOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  SyncOutlined,
  MailOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WalletOutlined,
  ExportOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  notification,
  Row,
  Typography,
} from "antd";
import WalletSection from "./WalletSection";
import {
  BASE_TOKEN,
  BRIDGE_BASE_CONTRACT_ADDRESS,
  BRIDGE_FEE,
  BRIDGE_VAULT_ABI,
  ERC20_ABI,
  type BridgeFormData,
  type TokenInfo,
  type WalletState,
} from "../constants";
import { useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEther,
} from "viem";
import { base } from "viem/chains";

const { Title, Paragraph, Text } = Typography;

const BridgeToSolanaTab = ({
  fetchTokenInfo,
  wallet,
  tokenInfo,
  setWallet,
  bridgeInventory,
}: {
  fetchTokenInfo: () => void;
  wallet: WalletState;
  tokenInfo: {
    base: TokenInfo | null;
    ancient: TokenInfo | null;
  };
  setWallet: (wallet: WalletState) => void;
  bridgeInventory: string;
}) => {
  const [loading, setLoading] = useState(false);

  // Form states
  const [bridgeToSolanaForm, setBridgeToSolanaForm] = useState<BridgeFormData>({
    amount: "",
    recipientAddress: "",
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

  // Bridge to Solana
  const handleBridgeToSolana = async () => {
    const walletClient = getWalletClient();
    if (!walletClient || !wallet.isConnected) return;

    if (!bridgeToSolanaForm.amount || !bridgeToSolanaForm.recipientAddress) {
      notification.error({
        message: "Invalid Input",
        description: "Please fill in all fields",
      });
      return;
    }

    try {
      setLoading(true);

      // First approve the token spending
      const approved = await approveToken(
        BASE_TOKEN,
        bridgeToSolanaForm.amount
      );
      if (!approved) return;

      // Then call the bridge contract
      const hash = await walletClient.writeContract({
        address: BRIDGE_BASE_CONTRACT_ADDRESS as `0x${string}`,
        abi: BRIDGE_VAULT_ABI,
        functionName: "depositToBridgeOut",
        args: [
          parseEther(bridgeToSolanaForm.amount),
          bridgeToSolanaForm.recipientAddress,
          "solana",
        ],
        value: parseEther(BRIDGE_FEE),
        account: wallet.address as `0x${string}`,
      });

      await publicClient.waitForTransactionReceipt({ hash });

      notification.success({
        message: "Bridge Request Submitted",
        description:
          "Your bridge request has been submitted and will be processed within 48 hours",
      });

      setBridgeToSolanaForm({ amount: "", recipientAddress: "" });
      fetchTokenInfo(); // Refresh balances
    } catch (error) {
      console.error("Bridge failed:", error);
      notification.error({
        message: "Bridge Failed",
        description: "Failed to submit bridge request",
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
          <ArrowRightOutlined style={{ color: "#52c41a", marginRight: 8 }} />
          Bridge to Solana
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
            message="Requirements"
            description={`You must have wrapped ${
              tokenInfo.base?.symbol || "Base"
            } tokens to use this bridge. Available: ${
              tokenInfo.base
                ? parseFloat(tokenInfo.base.balance).toFixed(4)
                : "0"
            } tokens`}
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card size="small" style={{ textAlign: "center" }}>
              <ClockCircleOutlined style={{ fontSize: 24, color: "#faad14" }} />
              <div style={{ marginTop: 8 }}>
                <Text strong>Processing Time</Text>
                <br />
                <Text type="secondary">Up to 48 hours</Text>
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ textAlign: "center" }}>
              <DollarOutlined style={{ fontSize: 24, color: "#1890ff" }} />
              <div style={{ marginTop: 8 }}>
                <Text strong>Bridge Fee</Text>
                <br />
                <Text type="secondary">{BRIDGE_FEE} ETH</Text>
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ textAlign: "center" }}>
              <CheckCircleOutlined style={{ fontSize: 24, color: "#52c41a" }} />
              <div style={{ marginTop: 8 }}>
                <Text strong>Sequential</Text>
                <br />
                <Text type="secondary">FIFO Processing</Text>
              </div>
            </Card>
          </Col>
        </Row>

        <div>
          <div style={{ marginBottom: 16 }}>
            <Text strong>Amount (Wrapped Base Tokens)</Text>
            <Input
              placeholder="0.0"
              suffix={tokenInfo.base?.symbol || "WBASE"}
              size="large"
              style={{ marginTop: 8 }}
              value={bridgeToSolanaForm.amount}
              onChange={(e) =>
                setBridgeToSolanaForm((prev) => ({
                  ...prev,
                  amount: e.target.value,
                }))
              }
              disabled={!wallet.isConnected}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text strong>Solana Recipient Address</Text>
            <Input
              placeholder="Enter your Solana wallet address"
              size="large"
              style={{ marginTop: 8 }}
              value={bridgeToSolanaForm.recipientAddress}
              onChange={(e) =>
                setBridgeToSolanaForm((prev) => ({
                  ...prev,
                  recipientAddress: e.target.value,
                }))
              }
              disabled={!wallet.isConnected}
            />
          </div>

          <Button
            type="primary"
            onClick={handleBridgeToSolana}
            size="large"
            block
            icon={<ArrowRightOutlined />}
            disabled={!wallet.isConnected}
            loading={loading}
          >
            Bridge to Solana
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default BridgeToSolanaTab;
