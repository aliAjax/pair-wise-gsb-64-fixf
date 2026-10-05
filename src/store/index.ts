import { configureStore } from '@reduxjs/toolkit'
import haccpReducer, { COMMITTED_KEY, WORKING_KEY } from './haccpSlice'
import { haccpApi } from '../services/api'

export const store = configureStore({
  reducer: {
    haccp: haccpReducer,
    [haccpApi.reducerPath]: haccpApi.reducer
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(haccpApi.middleware)
})

store.subscribe(() => {
  const haccp = store.getState().haccp
  try {
    localStorage.setItem(WORKING_KEY, JSON.stringify(haccp))
  } catch {
    // The app remains usable when browser storage is unavailable.
  }
  // 写入失败期间冻结最近完整提交快照，恢复时以它为准。
  if (haccp.persist.simulateFailure) return
  try {
    localStorage.setItem(COMMITTED_KEY, JSON.stringify(haccp))
  } catch {
    // The app remains usable when browser storage is unavailable.
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
