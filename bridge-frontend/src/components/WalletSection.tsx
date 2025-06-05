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

import { Button, Card, Col, notification, Row, Typography } from "antd";
import { useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  http,
} from "viem";
import { base } from "viem/chains";
import type { TokenInfo, WalletState } from "../constants";

const { Title, Paragraph, Text } = Typography;

const WalletSection = ({
  setWallet,
  wallet,
  tokenInfo,
  bridgeInventory,
}: {
  setWallet: (wallet: WalletState) => void;
  wallet: WalletState;
  tokenInfo: {
    base: TokenInfo | null;
    ancient: TokenInfo | null;
  };
  bridgeInventory: string;
}) => {
  const [loading, setLoading] = useState(false);

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

  // Connect wallet
  const connectWallet = async () => {
    try {
      setLoading(true);

      if (!window.ethereum) {
        notification.error({
          message: "MetaMask Not Found",
          description: "Please install MetaMask to use this application.",
        });
        return;
      }

      const walletClient = getWalletClient();
      if (!walletClient) return;

      const [address] = await walletClient.requestAddresses();
      const balance = await publicClient.getBalance({ address });

      setWallet({
        isConnected: true,
        address,
        balance: formatEther(balance),
      });

      // Switch to Base network if needed
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }], // Base mainnet
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          // Add Base network
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x2105",
                chainName: "Base",
                nativeCurrency: {
                  name: "Ethereum",
                  symbol: "ETH",
                  decimals: 18,
                },
                rpcUrls: ["https://mainnet.base.org"],
                blockExplorerUrls: ["https://basescan.org"],
              },
            ],
          });
        }
      }

      notification.success({
        message: "Wallet Connected",
        description: `Connected to ${address.slice(0, 6)}...${address.slice(
          -4
        )}`,
      });
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      notification.error({
        message: "Connection Failed",
        description: "Failed to connect to MetaMask",
      });
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card style={{ marginBottom: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <WalletOutlined style={{ marginRight: 8 }} />
            Wallet Connection
          </Title>
          {wallet.isConnected && (
            <Text type="secondary">
              {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)} |{" "}
              {parseFloat(wallet.balance).toFixed(4)} ETH
            </Text>
          )}
        </div>
        <Button
          type={wallet.isConnected ? "default" : "primary"}
          onClick={connectWallet}
          loading={loading}
          icon={<WalletOutlined />}
        >
          {wallet.isConnected ? "Connected" : "Connect MetaMask"}
        </Button>
      </div>

      {wallet.isConnected && tokenInfo.base && tokenInfo.ancient && (
        <div style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Card size="small" style={{ textAlign: "center" }}>
                <Text strong>{tokenInfo.base.symbol}</Text>
                <br />
                <Text>{parseFloat(tokenInfo.base.balance).toFixed(4)}</Text>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ textAlign: "center" }}>
                <Text strong>{tokenInfo.ancient.symbol}</Text>
                <br />
                <Text>{parseFloat(tokenInfo.ancient.balance).toFixed(4)}</Text>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ textAlign: "center" }}>
                <Text strong>Bridge Inventory</Text>
                <br />
                <Text>{parseFloat(bridgeInventory).toFixed(4)}</Text>
              </Card>
            </Col>
          </Row>
        </div>
      )}
    </Card>
  );
};

export default WalletSection;
