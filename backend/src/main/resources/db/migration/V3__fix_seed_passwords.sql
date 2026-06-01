-- 개발 초기 시드 계정의 BCrypt 해시를 올바른 값으로 교체합니다.
-- 평문: admin1234
UPDATE users
SET password_hash = '$2b$10$6/.NItxz8VwlGfLVe5e/Pe119IAMB425N7Rv7XOtcxx1nq6o.N2Ty'
WHERE username IN ('admin', 'manager1', 'worker1');
