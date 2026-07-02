import Head from 'next/head'
import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <>
      <Head>
        <title>개인정보처리방침 | WMS Pro</title>
      </Head>
      <div className="min-h-screen bg-[#f5f7f4] py-12 px-4">
        <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow-sm p-8 text-sm text-[#344039] leading-relaxed">
          <h1 className="text-2xl font-bold mb-2">개인정보처리방침</h1>
          <p className="text-[#79867f] mb-8">시행일: 2024년 1월 1일 | 최종 수정: 2025년 1월 1일</p>

          <section className="mb-8">
            <h2 className="text-base font-semibold mb-3 border-b pb-2">1. 개인정보의 처리 목적</h2>
            <p>
              WMS Pro(이하 &quot;서비스&quot;)는 다음의 목적으로 개인정보를 처리합니다.
              처리한 개인정보는 다음의 목적 이외의 용도로는 사용되지 않으며, 이용 목적이 변경될 시에는
              사전 동의를 받을 예정입니다.
            </p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>회원 가입 및 관리: 회원제 서비스 이용에 따른 본인확인, 서비스 제공</li>
              <li>창고 관리 업무: 입출고, 재고, 주문, 피킹 등 물류 업무 처리</li>
              <li>서비스 개선: 서비스 이용 기록 분석 및 시스템 운영 관리</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-base font-semibold mb-3 border-b pb-2">2. 처리하는 개인정보 항목</h2>
            <table className="w-full border-collapse text-xs mt-2">
              <thead>
                <tr className="bg-[#f5f7f4]">
                  <th className="border border-[#d4bf99] px-3 py-2 text-left">구분</th>
                  <th className="border border-[#d4bf99] px-3 py-2 text-left">수집 항목</th>
                  <th className="border border-[#d4bf99] px-3 py-2 text-left">필수/선택</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-[#d4bf99] px-3 py-2">회원 가입 시</td>
                  <td className="border border-[#d4bf99] px-3 py-2">아이디, 비밀번호(암호화 저장), 이메일, 이름</td>
                  <td className="border border-[#d4bf99] px-3 py-2">필수</td>
                </tr>
                <tr>
                  <td className="border border-[#d4bf99] px-3 py-2">회원 가입 시</td>
                  <td className="border border-[#d4bf99] px-3 py-2">연락처</td>
                  <td className="border border-[#d4bf99] px-3 py-2">선택</td>
                </tr>
                <tr>
                  <td className="border border-[#d4bf99] px-3 py-2">서비스 이용 시</td>
                  <td className="border border-[#d4bf99] px-3 py-2">접속 IP, 이용 일시, 서비스 이용 기록</td>
                  <td className="border border-[#d4bf99] px-3 py-2">자동 수집</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="mb-8">
            <h2 className="text-base font-semibold mb-3 border-b pb-2">3. 개인정보의 보유 및 이용 기간</h2>
            <p>서비스는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>회원 정보: 회원 탈퇴 후 30일 이내 파기 (법령 보존 의무 항목 제외)</li>
              <li>접속 로그: 3개월</li>
              <li>전자상거래 관련 기록: 관계 법령에 따라 5년 보존 (전자상거래법)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-base font-semibold mb-3 border-b pb-2">4. 개인정보의 제3자 제공</h2>
            <p>
              서비스는 정보주체의 개인정보를 제1조에서 명시한 목적 범위 내에서만 처리하며,
              정보주체의 동의, 법률의 특별한 규정 등 관련 법령에 의한 경우에만 개인정보를 제3자에게 제공합니다.
              현재 제3자 제공 계약은 없습니다.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-base font-semibold mb-3 border-b pb-2">5. 개인정보처리의 위탁</h2>
            <p>서비스는 현재 개인정보 처리 업무를 외부 업체에 위탁하고 있지 않습니다.</p>
          </section>

          <section className="mb-8">
            <h2 className="text-base font-semibold mb-3 border-b pb-2">6. 정보주체의 권리·의무 및 그 행사 방법</h2>
            <p>정보주체는 서비스에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>개인정보 열람 요구</li>
              <li>오류 등이 있을 경우 정정 요구</li>
              <li>삭제 요구</li>
              <li>처리 정지 요구</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-base font-semibold mb-3 border-b pb-2">7. 개인정보의 파기</h2>
            <p>서비스는 개인정보 보유기간의 경과, 처리 목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>전자적 파일: 복구 불가능한 방법으로 영구 삭제</li>
              <li>인쇄물·서면: 분쇄 또는 소각</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-base font-semibold mb-3 border-b pb-2">8. 개인정보의 안전성 확보 조치</h2>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>비밀번호 암호화: bcrypt 알고리즘으로 암호화하여 저장</li>
              <li>접근 통제: JWT 기반 인증으로 비인가 접근 차단</li>
              <li>전송 구간 암호화: HTTPS/TLS 적용</li>
              <li>접속 기록 보관: 최소 3개월 이상 보관</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-base font-semibold mb-3 border-b pb-2">9. 개인정보 보호책임자</h2>
            <div className="bg-[#f5f7f4] rounded-lg p-4 text-xs">
              <p><strong>성명:</strong> [담당자 이름 입력 필요]</p>
              <p className="mt-1"><strong>직책:</strong> [직책 입력 필요]</p>
              <p className="mt-1"><strong>이메일:</strong> [이메일 입력 필요]</p>
              <p className="mt-1"><strong>전화번호:</strong> [전화번호 입력 필요]</p>
            </div>
            <p className="mt-3 text-[#79867f] text-xs">
              정보주체는 서비스의 서비스를 이용하시면서 발생한 모든 개인정보 보호 관련 문의, 불만처리, 피해구제 등에
              관한 사항을 개인정보 보호책임자에게 문의하실 수 있습니다.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-base font-semibold mb-3 border-b pb-2">10. 개인정보처리방침 변경</h2>
            <p>이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경 내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지합니다.</p>
          </section>

          <div className="mt-10 pt-6 border-t flex gap-4 justify-center">
            <Link href="/login" className="text-[var(--color-primary)] hover:underline text-sm">
              로그인으로 돌아가기
            </Link>
            <Link href="/register" className="text-[var(--color-primary)] hover:underline text-sm">
              회원가입으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
