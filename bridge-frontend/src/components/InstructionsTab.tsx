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
import { Alert, Button, Card, Divider, Steps, Tag, Typography } from "antd";
import WalletSection from "./WalletSection";
import ContractLinks from "./ContractLinks";
import { BRIDGE_FEE, type TokenInfo, type WalletState } from "../constants";
import { useState } from "react";

const { Title, Paragraph, Text } = Typography;

const InstructionsTab = ({
  wallet,
  setWallet,
  setActiveTab,
  tokenInfo,
  bridgeInventory,
}: {
  wallet: WalletState;
  setWallet: (wallet: WalletState) => void;
  setActiveTab: (tab: string) => void;
  tokenInfo: {
    base: TokenInfo | null;
    ancient: TokenInfo | null;
  };
  bridgeInventory: string;
}) => {
  const [loading, setLoading] = useState(false);
  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <WalletSection
        wallet={wallet}
        setWallet={setWallet}
        tokenInfo={tokenInfo}
        bridgeInventory={bridgeInventory}
      />
      <ContractLinks />

      <Card>
        <Title level={2}>
          <InfoCircleOutlined style={{ color: "#1890ff", marginRight: 8 }} />
          Bridge Instructions
        </Title>

        <Alert
          message="Important Notice"
          description="This is a centralized bridge service. All bridging operations are processed manually and may take up to 48 hours to complete."
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Steps
          direction="vertical"
          current={-1}
          items={[
            {
              title: "If you have the old Base token",
              description: (
                <div>
                  <Paragraph>
                    You can deposit it for wrapped Base which is used by the
                    bridge.
                  </Paragraph>
                  <Button type="primary" onClick={() => setActiveTab("4")}>
                    Go to "Migrate Ancient" tab <ArrowRightOutlined />
                  </Button>
                </div>
              ),
              icon: <SyncOutlined />,
            },
            {
              title: "Bridge to Solana",
              description: (
                <div>
                  <Paragraph>
                    You must have the wrapped Base token. Deposit Base token and
                    specify your Solana address to receive at.
                  </Paragraph>
                  <ul>
                    <li>Bridging is centralized and manual</li>
                    <li>Processing time: up to 48 hours</li>
                    <li>Processed in sequential order</li>
                    <li>
                      Fee: <Tag color="orange">{BRIDGE_FEE} ETH</Tag>
                    </li>
                  </ul>
                  <Button type="primary" onClick={() => setActiveTab("2")}>
                    Go to "Bridge to Solana" tab <ArrowRightOutlined />
                  </Button>
                </div>
              ),
              icon: <ArrowRightOutlined />,
            },
            {
              title: "Bridge back to Base from Solana",
              description: (
                <div>
                  <Paragraph>
                    <strong>Step 1:</strong> Send Solana tokens to the Solana
                    bridge address with memo of the Base EVM wallet you want to
                    receive at.
                  </Paragraph>
                  <Paragraph>
                    <strong>Step 2:</strong> Request bridging with the same EVM
                    wallet to receive at. This is important to match onchain
                    proofs.
                  </Paragraph>
                  <ul>
                    <li>Bridging is centralized and manual</li>
                    <li>Processing time: up to 48 hours</li>
                    <li>Processed in sequential order</li>
                    <li>
                      Fee: <Tag color="orange">{BRIDGE_FEE} ETH</Tag>
                    </li>
                  </ul>
                  <Button type="primary" onClick={() => setActiveTab("3")}>
                    Go to "Bridge to Base" tab <ArrowLeftOutlined />
                  </Button>
                </div>
              ),
              icon: <ArrowLeftOutlined />,
            },
          ]}
        />

        <Divider />

        <Card
          size="small"
          style={{ backgroundColor: "#f6ffed", border: "1px solid #b7eb8f" }}
        >
          <Title level={4}>
            <MailOutlined style={{ color: "#52c41a", marginRight: 8 }} />
            Need Help?
          </Title>
          <Paragraph>
            If you have any issues or questions, email us at{" "}
            <a href="mailto:admin@officex.app">admin@officex.app</a>
          </Paragraph>
        </Card>
      </Card>
    </div>
  );
};

export default InstructionsTab;
