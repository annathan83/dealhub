"use client";

import DeepAnalysisPanel from "@/components/DeepAnalysisPanel";
import type { DeepAnalysisContent } from "@/lib/services/entity/deepAnalysisService";
import type { DealStatus } from "@/types";

type Props = {
  dealId: string;
  dealStatus: DealStatus;
  deepAnalysis: DeepAnalysisContent | null;
  deepAnalysisStale: boolean;
  deepAnalysisRunAt: string | null;
  latestSourceAt: string | null;
};

export default function AIAnalysisTab({
  dealId,
  dealStatus,
  deepAnalysis,
  deepAnalysisStale,
  deepAnalysisRunAt,
  latestSourceAt,
}: Props) {
  return (
    <DeepAnalysisPanel
      dealId={dealId}
      dealStatus={dealStatus}
      analysis={deepAnalysis}
      isStale={deepAnalysisStale}
      runAt={deepAnalysisRunAt}
      latestSourceAt={latestSourceAt}
    />
  );
}
