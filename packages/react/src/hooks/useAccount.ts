import {
  type DependencyList,
  type EffectCallback,
  useEffect,
  useRef,
} from "react"
import { useLaserEyes } from "../providers/hooks"
import { compareValues } from "../utils/comparison"

type UseAccountReturnType =
  | {
      addresses: string[]
      payment: string
      ordinals: string
      publicKey: string
    }
  | undefined

export function useAccount(): UseAccountReturnType {
  const { address, paymentAddress, accounts, publicKey } = useLaserEyes(
    ({ address, paymentAddress, accounts, publicKey }) => ({
      address,
      paymentAddress,
      accounts,
      publicKey,
    }),
  )

  return !address
    ? undefined
    : {
        addresses: accounts,
        payment: paymentAddress,
        ordinals: address,
        publicKey,
      }
}

export function useAccountEffect(
  callback: EffectCallback,
  dependencies: DependencyList,
) {
  const store = useLaserEyes(x => x.client?.$store)
  const dependenciesRef = useRef<DependencyList>()
  const dependenciesVersionRef = useRef(0)

  if (
    !dependenciesRef.current ||
    dependenciesRef.current.length !== dependencies.length ||
    dependencies.some((dep, index) =>
      !Object.is(dep, dependenciesRef.current?.[index]),
    )
  ) {
    dependenciesVersionRef.current += 1
    dependenciesRef.current = dependencies
  }

  const dependenciesVersion = dependenciesVersionRef.current

  useEffect(() => {
    if (!store) return

    let unsub: ReturnType<EffectCallback>
    const stUnsub = store.subscribe((v, ov, ck) => {
      if (ck === "accounts") {
        if (!compareValues(v.accounts, ov?.accounts)) {
          unsub?.()
          unsub = callback()
        }
      }
    })

    return () => {
      stUnsub()
      unsub?.()
    }
  }, [store, callback, dependenciesVersion])
}
