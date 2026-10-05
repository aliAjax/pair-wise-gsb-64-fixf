import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { seedBatches } from '../data/seed'
import type { Batch } from '../types'

export const haccpApi = createApi({
  reducerPath: 'haccpApi',
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    loadBatchSnapshot: builder.query<Batch[], void>({
      queryFn: async () => ({ data: structuredClone(seedBatches) })
    }),
    checkReleaseReadiness: builder.query<{ ready: boolean; reasons: string[] }, { batchId: string; openDeviations: number; basisStale: boolean }>({
      queryFn: async ({ batchId, openDeviations, basisStale }) => {
        const reasons: string[] = []
        if (basisStale) reasons.push(`${batchId}的清洗放行依据已失效，需重新绑定后重算`)
        if (openDeviations > 0) reasons.push(`${batchId}仍有${openDeviations}项未关闭偏差`)
        return { data: { ready: reasons.length === 0, reasons } }
      }
    })
  })
})

export const { useLoadBatchSnapshotQuery, useCheckReleaseReadinessQuery } = haccpApi
