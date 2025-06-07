import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  List,
  notification,
  Row,
  Tag,
  Typography,
} from "antd";
import WalletSection from "./WalletSection";
import {
  ArrowLeftOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import {
  BRIDGE_BASE_CONTRACT_ADDRESS,
  BRIDGE_FEE,
  BRIDGE_VAULT_ABI,
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

const BridgeToBaseTab = ({
  wallet,

  tokenInfo,
  setWallet,
  bridgeInventory,
}: {
  wallet: WalletState;

  tokenInfo: {
    base: TokenInfo | null;
    ancient: TokenInfo | null;
  };
  setWallet: (wallet: WalletState) => void;
  bridgeInventory: string;
}) => {
  const [loading, setLoading] = useState(false);

  const [bridgeToBaseForm, setBridgeToBaseForm] = useState<BridgeFormData>({
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

  // Bridge to Base
  const handleBridgeToBase = async () => {
    const walletClient = getWalletClient();
    if (!walletClient || !wallet.isConnected) return;

    if (!bridgeToBaseForm.amount || !bridgeToBaseForm.recipientAddress) {
      notification.error({
        message: "Invalid Input",
        description: "Please fill in all fields",
      });
      return;
    }

    try {
      setLoading(true);

      const hash = await walletClient.writeContract({
        address: BRIDGE_BASE_CONTRACT_ADDRESS as `0x${string}`,
        abi: BRIDGE_VAULT_ABI,
        functionName: "depositToBridgeIn",
        args: [
          parseEther(bridgeToBaseForm.amount),
          bridgeToBaseForm.recipientAddress as `0x${string}`,
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

      setBridgeToBaseForm({ amount: "", recipientAddress: "" });
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
          <ArrowLeftOutlined style={{ color: "#1890ff", marginRight: 8 }} />
          Bridge to Base
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
            message="Important Steps"
            description="Before using this form, you must first send your Solana tokens to the bridge address with your Base wallet address as memo."
            type="warning"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Card
          size="small"
          style={{ backgroundColor: "#fff7e6", marginBottom: 24 }}
        >
          <Title level={4}>Step 1: Send Tokens on Solana</Title>
          <List
            size="small"
            dataSource={[
              "Send your Solana tokens to the bridge address",
              "Include your Base EVM wallet address in the memo",
              "Wait for transaction confirmation",
            ]}
            renderItem={(item, index) => (
              <List.Item>
                <Text>
                  <Tag color="blue">{index + 1}</Tag>
                  {item}
                </Text>
              </List.Item>
            )}
          />
        </Card>

        <Card
          size="small"
          style={{ backgroundColor: "#f6ffed", marginBottom: 24 }}
        >
          <Title level={4}>Step 2: Request Bridge Processing</Title>
          <Paragraph>
            Use the form below to request processing. The Base wallet address
            must match the memo you used in Step 1.
          </Paragraph>
        </Card>

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
            <Text strong>Amount (Solana Tokens Sent)</Text>
            <Input
              placeholder="0.0"
              suffix="SOL-TOKEN"
              size="large"
              style={{ marginTop: 8 }}
              value={bridgeToBaseForm.amount}
              onChange={(e) =>
                setBridgeToBaseForm((prev) => ({
                  ...prev,
                  amount: e.target.value,
                }))
              }
              disabled={!wallet.isConnected}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text strong>Base EVM Recipient Address</Text>
            <Input
              placeholder="0x... (must match memo used in Solana transaction)"
              size="large"
              style={{ marginTop: 8 }}
              value={bridgeToBaseForm.recipientAddress}
              onChange={(e) =>
                setBridgeToBaseForm((prev) => ({
                  ...prev,
                  recipientAddress: e.target.value,
                }))
              }
              disabled={!wallet.isConnected}
            />
            {wallet.isConnected && (
              <Button
                type="link"
                size="small"
                onClick={() =>
                  setBridgeToBaseForm((prev) => ({
                    ...prev,
                    recipientAddress: wallet.address,
                  }))
                }
              >
                Use connected wallet address
              </Button>
            )}
          </div>

          <Button
            type="primary"
            onClick={handleBridgeToBase}
            size="large"
            block
            icon={<ArrowLeftOutlined />}
            disabled={!wallet.isConnected}
            loading={loading}
          >
            Request Bridge to Base
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default BridgeToBaseTab;
