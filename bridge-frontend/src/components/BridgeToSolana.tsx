import {
  SwapOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
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
  Tabs,
} from "antd";
import WalletSection from "./WalletSection";
import {
  BASE_TOKEN,
  BRIDGE_BASE_CONTRACT_ADDRESS,
  BRIDGE_FEE,
  BRIDGE_VAULT_ABI,
  ERC20_ABI,
  SOLANA_BRIDGE_WALLET,
  type BridgeFormData,
  type TokenInfo,
  type WalletState,
} from "../constants";
import { useState, useCallback, useMemo } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEther,
} from "viem";
import { base } from "viem/chains";

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const BridgeToSolanaTab = ({
  fetchTokenInfo,
  wallet,
  tokenInfo,
  setWallet,
  bridgeInventory,
  setActiveTab,
}: {
  fetchTokenInfo: () => void;
  wallet: WalletState;
  tokenInfo: {
    base: TokenInfo | null;
    ancient: TokenInfo | null;
  };
  setWallet: (wallet: WalletState) => void;
  bridgeInventory: string;
  setActiveTab: (tab: string) => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [activeTabInner, setActiveTabInner] = useState("bridge-out");

  // Form states
  const [bridgeToSolanaForm, setBridgeToSolanaForm] = useState<BridgeFormData>({
    amount: "",
    recipientAddress: "",
  });

  // NEW: Bridge from Solana form state
  const [bridgeFromSolanaForm, setBridgeFromSolanaForm] =
    useState<BridgeFormData>({
      amount: "",
      recipientAddress: "",
      txDepositProof: "", // NEW: Transaction proof from Solana
    });

  // Memoize viem clients to prevent recreation on every render
  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: base,
        transport: http(
          "https://base-mainnet.g.alchemy.com/v2/EAF1m-3-59-iXzmNbA99cvWq9pFovfxu"
        ),
      }),
    []
  );

  const getWalletClient = useCallback(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      return createWalletClient({
        chain: base,
        transport: custom(window.ethereum),
      });
    }
    return null;
  }, []);

  // Approve token spending
  const approveToken = useCallback(
    async (tokenAddress: string, amount: string) => {
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
    },
    [getWalletClient, wallet.isConnected, wallet.address, publicClient]
  );

  // Bridge to Solana
  const handleBridgeToSolana = useCallback(async () => {
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
        btn: (
          <Button type="primary" size="small" onClick={() => setActiveTab("5")}>
            View Logs
          </Button>
        ),
        duration: 0, // Don't auto-close
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
  }, [
    getWalletClient,
    wallet.isConnected,
    wallet.address,
    bridgeToSolanaForm,
    approveToken,
    publicClient,
    fetchTokenInfo,
  ]);

  // NEW: Bridge from Solana
  const handleBridgeFromSolana = useCallback(async () => {
    const walletClient = getWalletClient();
    if (!walletClient || !wallet.isConnected) return;

    if (
      !bridgeFromSolanaForm.recipientAddress ||
      !bridgeFromSolanaForm.txDepositProof
    ) {
      notification.error({
        message: "Invalid Input",
        description:
          "Please fill in all fields including the transaction proof",
      });
      return;
    }

    try {
      setLoading(true);

      // Call the bridge contract with the new txDepositProof parameter
      const hash = await walletClient.writeContract({
        address: BRIDGE_BASE_CONTRACT_ADDRESS as `0x${string}`,
        abi: BRIDGE_VAULT_ABI,
        functionName: "depositToBridgeIn",
        args: [
          bridgeFromSolanaForm.recipientAddress as `0x${string}`,
          "solana",
          bridgeFromSolanaForm.txDepositProof, // NEW: Include the transaction proof
        ],
        value: parseEther(BRIDGE_FEE),
        account: wallet.address as `0x${string}`,
      });

      await publicClient.waitForTransactionReceipt({ hash });

      notification.success({
        message: "Bridge Request Submitted",
        description:
          "Your bridge-in request has been submitted and will be processed within 48 hours",
        btn: (
          <Button type="primary" size="small" onClick={() => setActiveTab("5")}>
            View Logs
          </Button>
        ),
        duration: 0, // Don't auto-close
      });

      setBridgeFromSolanaForm({
        amount: "",
        recipientAddress: "",
        txDepositProof: "",
      });
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
  }, [
    getWalletClient,
    wallet.isConnected,
    wallet.address,
    bridgeFromSolanaForm,
    publicClient,
    fetchTokenInfo,
  ]);

  // Memoize the tab components to prevent unnecessary re-renders
  const BridgeOutTab = useMemo(
    () => (
      <div>
        <Title level={3}>
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
              tokenInfo.base ? tokenInfo.base.balance : "0"
            } tokens`}
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <div>
          <div style={{ marginBottom: 16 }}>
            <Text strong>Amount (Wrapped Base Tokens)</Text>
            <Input
              placeholder="0.0"
              suffix={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, height: "auto", fontSize: 12 }}
                    onClick={() =>
                      setBridgeToSolanaForm((prev) => ({
                        ...prev,
                        amount:
                          tokenInfo.base?.balance?.replace(/,/g, "") || "0",
                      }))
                    }
                    disabled={!wallet.isConnected || !tokenInfo.base?.balance}
                  >
                    MAX
                  </Button>
                  <span>{tokenInfo.base?.symbol || "WBASE"}</span>
                </div>
              }
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
      </div>
    ),
    [
      wallet.isConnected,
      tokenInfo.base,
      bridgeToSolanaForm,
      handleBridgeToSolana,
      loading,
    ]
  );

  const BridgeInTab = useMemo(
    () => (
      <div>
        <Title level={3}>
          <ArrowLeftOutlined style={{ color: "#1890ff", marginRight: 8 }} />
          Bridge from Solana
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
            message="Instructions"
            description={`First send your tokens to the Solana Bridge Wallet ${SOLANA_BRIDGE_WALLET} with the BaseL2 recipient address as a memo in your Solana transaction. Then submit this form with the transaction proof.`}
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <div>
          <div style={{ marginBottom: 16 }}>
            <Text strong>Base Recipient Address</Text>
            <Input
              placeholder="Enter the Base address to receive tokens"
              size="large"
              style={{ marginTop: 8 }}
              value={bridgeFromSolanaForm.recipientAddress}
              onChange={(e) =>
                setBridgeFromSolanaForm((prev) => ({
                  ...prev,
                  recipientAddress: e.target.value,
                }))
              }
              disabled={!wallet.isConnected}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text strong>
              <FileTextOutlined style={{ marginRight: 4 }} />
              Solana Transaction Proof
            </Text>
            <Input.TextArea
              placeholder="Enter the Solana transaction signature/hash as proof of your deposit"
              size="large"
              style={{ marginTop: 8 }}
              rows={3}
              value={bridgeFromSolanaForm.txDepositProof}
              onChange={(e) =>
                setBridgeFromSolanaForm((prev) => ({
                  ...prev,
                  txDepositProof: e.target.value,
                }))
              }
              disabled={!wallet.isConnected}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              This should be the transaction signature from your Solana wallet
              when you sent tokens to the admin address
            </Text>
          </div>

          <Button
            type="primary"
            onClick={handleBridgeFromSolana}
            size="large"
            block
            icon={<ArrowLeftOutlined />}
            disabled={!wallet.isConnected}
            loading={loading}
          >
            Submit Bridge Request
          </Button>
        </div>
      </div>
    ),
    [wallet.isConnected, bridgeFromSolanaForm, handleBridgeFromSolana, loading]
  );

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
          <SwapOutlined style={{ color: "#722ed1", marginRight: 8 }} />
          Solana Bridge
        </Title>

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

        <Tabs
          activeKey={activeTabInner}
          onChange={setActiveTabInner}
          type="card"
        >
          <TabPane
            tab={
              <span>
                <ArrowRightOutlined />
                To Solana
              </span>
            }
            key="bridge-out"
          >
            {BridgeOutTab}
          </TabPane>

          <TabPane
            tab={
              <span>
                <ArrowLeftOutlined />
                From Solana
              </span>
            }
            key="bridge-in"
          >
            {BridgeInTab}
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default BridgeToSolanaTab;
