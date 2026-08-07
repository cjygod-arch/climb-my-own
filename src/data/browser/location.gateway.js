/**
 * data/browser/location.gateway.js — LocationGateway 브라우저 구현.
 *
 * navigator.geolocation을 아는 유일한 파일이다.
 *
 * @implements {import('../../domain/ports/locationGateway.js').LocationGateway}
 */

import { ok, err } from '../../core/result.js';
import { LocationErrorCode } from '../../domain/ports/locationGateway.js';

const OPTIONS = Object.freeze({
  // 등산로에서 수십 미터 오차는 코스 이탈 판정을 뒤집는다. 정확도를 우선한다.
  enableHighAccuracy: true,
  // 신호가 나쁜 계곡에서도 포기하지 않도록 넉넉히 기다린다.
  timeout: 20000,
  // 캐시된 위치는 쓰지 않는다. 움직이는 중이라 금방 낡는다.
  maximumAge: 0,
});

/**
 * @param {{ now: () => string }} deps
 */
export function createBrowserLocationGateway({ now }) {
  function toFix(position) {
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy ?? 9999,
      altitude: position.coords.altitude ?? null,
      at: now(),
    };
  }

  function toError(error) {
    switch (error?.code) {
      case 1: return { code: LocationErrorCode.PERMISSION_DENIED, message: '위치 권한이 거부되었습니다. 브라우저 설정에서 위치 접근을 허용해 주세요.' };
      case 2: return { code: LocationErrorCode.UNAVAILABLE, message: '위치 신호를 잡지 못했습니다. 하늘이 트인 곳으로 이동해 보세요.' };
      case 3: return { code: LocationErrorCode.TIMEOUT, message: '위치 확인이 지연되고 있습니다.' };
      default: return { code: LocationErrorCode.UNAVAILABLE, message: error?.message ?? '위치를 확인할 수 없습니다.' };
    }
  }

  const supported = () =>
    typeof navigator !== 'undefined' &&
    'geolocation' in navigator &&
    // 브라우저는 보안 컨텍스트(HTTPS 또는 localhost)에서만 위치를 준다.
    (window.isSecureContext ?? false);

  return {
    isSupported: supported,

    async getCurrent() {
      if (!supported()) {
        return err(
          LocationErrorCode.UNSUPPORTED,
          'HTTPS 환경에서만 위치를 사용할 수 있습니다. (localhost는 예외)',
        );
      }

      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve(ok(toFix(position))),
          (error) => {
            const e = toError(error);
            resolve(err(e.code, e.message, error));
          },
          OPTIONS,
        );
      });
    },

    watch(onFix, onError) {
      if (!supported()) {
        onError?.({
          code: LocationErrorCode.UNSUPPORTED,
          message: 'HTTPS 환경에서만 위치를 사용할 수 있습니다. (localhost는 예외)',
        });
        return () => {};
      }

      const id = navigator.geolocation.watchPosition(
        (position) => onFix(toFix(position)),
        // 산행 중 신호가 끊기는 것은 정상이다. 감시를 멈추지 않고 알리기만 한다.
        (error) => onError?.(toError(error)),
        OPTIONS,
      );

      return () => navigator.geolocation.clearWatch(id);
    },
  };
}
