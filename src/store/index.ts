import { configureStore } from '@reduxjs/toolkit'
import haccpReducer, { restoreSnapshot } from './haccpSlice'
import { haccpApi } from '../services/api'
import { emitPersistFailure, getLastCommitted, initPersistence, persistState } from '../services/persistence'

export const store = configureStore({
  reducer: {
    haccp: haccpReducer,
    [haccpApi.reducerPath]: haccpApi.reducer
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(haccpApi.middleware)
})

initPersistence()

let restoring = false
store.subscribe(() => {
  if (restoring) return
  try {
    persistState(JSON.stringify(store.getState().haccp))
  } catch {
    // 写入失败：按最近完整批次恢复，重试不会重复追加审计。
    const committed = getLastCommitted()
    emitPersistFailure('写入失败：已按最近完整批次恢复，可安全重试，审计不会重复追加。')
    if (committed) {
      restoring = true
      setTimeout(() => {
        store.dispatch(restoreSnapshot(JSON.parse(committed)))
        restoring = false
      }, 0)
    }
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
