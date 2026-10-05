import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { seedBatches } from '../data/seed'
import { releaseBasisView } from './releaseBasis'
import type { Batch } from '../types'
import type { RootState } from '../store'

export const haccpApi = createApi({
  reducerPath: 'haccpApi',
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    loadBatchSnapshot: builder.query<Batch[], void>({
      queryFn: async () => ({ data: structuredClone(seedBatches) })
    }),
    // 放行就绪判定与批次详情、偏差工作台、追溯审计共用同一依据。
    checkReleaseReadiness: builder.query<{ ready: boolean; reasons: string[] }, string>({
      queryFn: async (batchId, api) => {
        const view = releaseBasisView((api.getState() as RootState).haccp, batchId)
        return { data: { ready: view?.releasable ?? false, reasons: view?.reasons ?? ['批次不存在'] } }
      }
    })
  })
})

export const { useLoadBatchSnapshotQuery, useCheckReleaseReadinessQuery } = haccpApi
