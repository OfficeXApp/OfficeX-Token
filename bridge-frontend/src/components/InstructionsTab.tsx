import {
  InfoCircleOutlined,
  ArrowRightOutlined,
  SyncOutlined,
  MailOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Divider, Steps, Tag, Typography } from "antd";
import WalletSection from "./WalletSection";
import ContractLinks from "./ContractLinks";
import { BRIDGE_FEE, type TokenInfo, type WalletState } from "../constants";

const { Title, Paragraph } = Typography;

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
  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <WalletSection
        wallet={wallet}
        setWallet={setWallet}
        tokenInfo={tokenInfo}
        bridgeInventory={bridgeInventory}
      />
      <ContractLinks />

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          margin: "32px 0px",
        }}
      >
        <iframe
          width="560"
          height="315"
          src="https://www.youtube.com/embed/YVY18lDRbPU?si=PCNPX8EWBITOBClO"
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        ></iframe>
      </div>

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
              title: "Bridge Solana",
              description: (
                <div>
                  <Paragraph>
                    You must have the wrapped Base token or Solana token.
                    Deposit Base token or Solana token and specify your wallet
                    address to receive at.
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
                    Go to "Bridge Solana" tab <ArrowRightOutlined />
                  </Button>
                </div>
              ),
              icon: <ArrowRightOutlined />,
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
