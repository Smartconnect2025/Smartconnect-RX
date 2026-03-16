"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { UseFormReturn } from "react-hook-form";
import SignatureCanvas from "react-signature-canvas";

import { Button } from "@/components/ui/button";
import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Trash2, Pen } from "lucide-react";

import { ProfileFormValues } from "./types";

interface SignatureSectionProps {
  form: UseFormReturn<ProfileFormValues>;
}

export const SignatureSection: React.FC<SignatureSectionProps> = ({ form }) => {
  const sigRef = useRef<SignatureCanvas>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  const currentSignature = form.watch("signatureUrl");

  const setupCanvas = useCallback(() => {
    const canvas = sigRef.current?.getCanvas();
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;

    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(ratio, ratio);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }

    canvas.style.touchAction = "none";

    setIsCanvasReady(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(setupCanvas, 100);
    window.addEventListener("resize", setupCanvas);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", setupCanvas);
    };
  }, [setupCanvas]);

  useEffect(() => {
    if (!isCanvasReady || !currentSignature || !sigRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    sigRef.current.fromDataURL(currentSignature, {
      width: rect.width,
      height: rect.height,
    });
    setIsEmpty(false);
  }, [isCanvasReady, currentSignature]);

  const handleClear = () => {
    sigRef.current?.clear();
    form.setValue("signatureUrl", "", { shouldDirty: true });
    setIsEmpty(true);
  };

  const handleEnd = () => {
    setIsSigning(false);
    if (sigRef.current && !sigRef.current.isEmpty()) {
      const dataUrl = sigRef.current.toDataURL("image/png");
      form.setValue("signatureUrl", dataUrl, { shouldDirty: true });
      setIsEmpty(false);
    }
  };

  const handleBegin = () => {
    setIsSigning(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Signature</h3>
        {!isEmpty && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-red-600"
            data-testid="button-clear-signature"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <p className="text-sm text-gray-500">
        Draw your signature below. This will be used for prescriptions and other
        documents.
      </p>

      <FormField
        control={form.control}
        name="signatureUrl"
        render={() => (
          <FormItem>
            <FormLabel className="sr-only">Signature</FormLabel>
            <div
              ref={containerRef}
              className={`relative border-2 rounded-xl bg-white h-[200px] transition-colors ${
                isSigning
                  ? "border-blue-500 shadow-md"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <SignatureCanvas
                ref={sigRef}
                canvasProps={{
                  className: "w-full h-full rounded-xl",
                  style: { cursor: "default", touchAction: "none" },
                }}
                penColor="#1a1a2e"
                minWidth={1.5}
                maxWidth={3.5}
                velocityFilterWeight={0.7}
                backgroundColor="rgba(255, 255, 255, 0)"
                onBegin={handleBegin}
                onEnd={handleEnd}
              />
              {isEmpty && !currentSignature && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="flex flex-col items-center gap-2 text-gray-300">
                    <Pen className="h-8 w-8" />
                    <span className="text-sm font-medium">Sign here</span>
                  </div>
                </div>
              )}
              <div className="absolute bottom-4 left-6 right-6 border-b border-gray-200 pointer-events-none" />
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
