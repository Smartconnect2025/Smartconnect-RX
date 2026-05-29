"use client";

import { useEffect, useState } from "react";
import { loadStripe, StripeCardElement } from "@stripe/stripe-js";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface StripeCardInputProps {
  onCardReady: (cardElement: StripeCardElement | null) => void;
  saveCard: boolean;
  onSaveCardChange: (save: boolean) => void;
  disabled?: boolean;
}

export function StripeCardInput({
  onCardReady,
  saveCard,
  onSaveCardChange,
  disabled = false,
}: StripeCardInputProps) {
  const [cardElement, setCardElement] = useState<StripeCardElement | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let isMounted = true;

    const initializeStripe = async () => {
      const stripe = await stripePromise;
      if (!stripe || !isMounted) return;

      const elements = stripe.elements();
      const card = elements.create("card", {
        style: {
          base: {
            fontSize: "16px",
            color: "#1f2937",
            fontFamily: "Inter, sans-serif",
            "::placeholder": {
              color: "#9ca3af",
            },
          },
          invalid: {
            color: "#ef4444",
            iconColor: "#ef4444",
          },
        },
        hidePostalCode: true,
      });

      card.mount("#card-element");

      card.on("change", (event) => {
        setError(event.error ? event.error.message : "");
      });

      setCardElement(card);
      onCardReady(card);
    };

    initializeStripe();

    return () => {
      isMounted = false;
      if (cardElement) {
        cardElement.unmount();
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-gray-700 font-medium mb-2 block">
          Payment Method <span className="text-red-500">*</span>
        </Label>
        <div
          id="card-element"
          className={`p-4 border rounded-lg ${
            error ? "border-red-500" : "border-gray-300"
          } ${disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white"}`}
        />
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        <p className="text-xs text-gray-500 mt-2">
          Test card: 4242 4242 4242 4242 • Any future date • Any 3-digit CVC
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="save-card"
          checked={saveCard}
          onCheckedChange={(checked) => onSaveCardChange(checked as boolean)}
          disabled={disabled}
        />
        <label
          htmlFor="save-card"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
        >
          Save card for automatic future charges
        </label>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-sm text-green-800 font-semibold flex items-center gap-2">
          <span className="text-lg">✓</span>
          1-Click Prescriptions: With a card on file, future prescriptions charge automatically - no popups!
        </p>
      </div>
    </div>
  );
}
