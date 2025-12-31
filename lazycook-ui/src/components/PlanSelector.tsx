import { useState } from "react";

type Plan = "GO" | "PRO" | "ULTRA";

interface PlanSelectorProps {
  currentPlan: Plan;
  onSelectPlan: (plan: Plan) => void;
  onClose: () => void;
  isNewUser?: boolean;
}

const PLAN_DETAILS = {
  GO: {
    name: "GO",
    price: "Free",
    features: ["Gemini AI", "Basic features", "Standard support"],
    color: "blue"
  },
  PRO: {
    name: "PRO",
    price: "Free (Mock)",
    features: ["Grok AI", "Advanced features", "Priority support", "All GO features"],
    color: "purple"
  },
  ULTRA: {
    name: "ULTRA",
    price: "Free (Mock)",
    features: ["Grok + Gemini AI", "Premium features", "24/7 support", "All PRO features"],
    color: "gold"
  }
};

export default function PlanSelector({ currentPlan, onSelectPlan, onClose, isNewUser = false }: PlanSelectorProps) {
  const [selectedPlan, setSelectedPlan] = useState<Plan>(currentPlan);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleConfirm = async () => {
    setIsUpgrading(true);
    try {
      // Mock subscription - in real app, this would call payment API
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API call
      onSelectPlan(selectedPlan);
      if (!isNewUser && selectedPlan === currentPlan) {
        onClose();
      }
    } catch (error) {
      console.error("Error selecting plan:", error);
    } finally {
      setIsUpgrading(false);
    }
  };

  const isCurrentPlan = (plan: Plan) => plan === currentPlan;
  const isSelectedPlan = (plan: Plan) => plan === selectedPlan;

  return (
    <div className="lc-plan-selector-overlay" onClick={onClose}>
      <div className="lc-plan-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lc-plan-selector-header">
          <h2>{isNewUser ? "Welcome! Choose Your Plan" : "Choose Your Plan"}</h2>
          {!isNewUser && <button className="lc-plan-selector-close" onClick={onClose}>×</button>}
        </div>

        <div className="lc-plan-selector-grid">
          {(Object.keys(PLAN_DETAILS) as Plan[]).map((plan) => {
            const details = PLAN_DETAILS[plan];
            const isCurrent = isCurrentPlan(plan);
            const isSelected = isSelectedPlan(plan);

            return (
              <div
                key={plan}
                className={`lc-plan-card ${isCurrent ? 'lc-plan-current' : ''} ${isSelected ? 'lc-plan-selected' : ''}`}
                onClick={() => setSelectedPlan(plan)}
              >
                {isCurrent && (
                  <div className="lc-plan-badge">Current Plan</div>
                )}
                <div className="lc-plan-name" style={{ color: `var(--lc-${details.color})` }}>
                  {details.name}
                </div>
                <div className="lc-plan-price">{details.price}</div>
                <ul className="lc-plan-features">
                  {details.features.map((feature, idx) => (
                    <li key={idx}>✓ {feature}</li>
                  ))}
                </ul>
                {isSelected && !isCurrent && (
                  <div className="lc-plan-selected-indicator">Selected</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="lc-plan-selector-footer">
          {!isNewUser && (
            <button
              className="lc-plan-selector-cancel"
              onClick={onClose}
              disabled={isUpgrading}
            >
              Cancel
            </button>
          )}
          <button
            className="lc-plan-selector-confirm"
            onClick={handleConfirm}
            disabled={isUpgrading || (selectedPlan === currentPlan && !isNewUser)}
            style={isNewUser ? { width: '100%' } : {}}
          >
            {isUpgrading ? "Processing..." : isNewUser ? "Continue with Selected Plan" : selectedPlan === currentPlan ? "Current Plan" : "Upgrade Plan"}
          </button>
        </div>

        <div className="lc-plan-selector-note">
          <small>💡 All plans are currently free (mock mode). No payment required.</small>
        </div>
      </div>
    </div>
  );
}

