# TASK BRIEF: Class Hub — Landing page quản lý task / bài tập / thông báo lớp

## 1. Mục tiêu
Landing page công khai cho cả lớp xem; cán bộ lớp đăng nhập để thêm / sửa / xóa các mục: **Task lớp**, **Bài tập về nhà**, **Chú ý quan trọng**. Ảnh upload qua Uploadcare, dữ liệu lưu Supabase. Mọi thay đổi (tạo / sửa / xóa) trên bản ghi được lưu lịch sử, xem lại được và khôi phục được.

## 2. Stack
- Next.js (App Router, TypeScript), Tailwind CSS
- Supabase: Postgres + RLS (không dùng Supabase Auth)
- Uploadcare: `@uploadcare/react-uploader`
- Deploy: Vercel
- Mobile-first (đa số học sinh xem trên điện thoại)

## 3. Vai trò
| Role | Quyền |
|---|---|
| Public (không đăng nhập) | Xem các mục `published` |
| `officer` | Tạo / sửa mục của lớp, ghim, upload ảnh, xem lịch sử, khôi phục phiên bản cũ |
| `admin` (lớp trưởng/GVCN) | Toàn quyền officer + xóa mục + cấp/thu hồi role officer |

## 4. Database (Supabase SQL)

```sql
create type item_type as enum ('task', 'homework', 'notice');
create type item_priority as enum ('normal', 'high', 'urgent');
create type user_role as enum ('officer', 'admin');

create table profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^[a-z0-9_]{3,32}$'),
  password_hash text not null,
  full_name text not null,
  role user_role not null default 'officer',
  created_at timestamptz default now()
);

create table class_items (
  id uuid primary key default gen_random_uuid(),
  type item_type not null,
  title text not null,
  description text,
  subject text,                       -- môn học (cho homework)
  priority item_priority not null default 'normal',
  due_at timestamptz,                 -- mặc định task/homework: thời điểm tạo + 7 ngày
  is_pinned boolean not null default false,
  is_done boolean not null default false,
  is_published boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table item_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references class_items(id) on delete cascade,
  uc_uuid text not null,              -- Uploadcare file UUID
  cdn_url text not null,
  sort_order int default 0
);

create index on class_items (type, due_at);
create index on class_items (is_pinned, created_at desc);
```

### RLS
```sql
alter table profiles enable row level security;
alter table class_items enable row level security;
alter table item_images enable row level security;

create function is_officer() returns boolean language sql security definer as $$
  select exists (
    select 1 from profiles
    where id::text = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
  );
$$;
create function is_admin() returns boolean language sql security definer as $$
  select exists (
    select 1 from profiles
    where id::text = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
      and role = 'admin'
  );
$$;

-- class_items
create policy "public read published" on class_items for select using (is_published or is_officer());
create policy "officer insert" on class_items for insert with check (is_officer());
create policy "officer update" on class_items for update using (is_officer());
create policy "admin delete" on class_items for delete using (is_admin());

-- item_images (cùng quy tắc)
create policy "public read images" on item_images for select using (true);
create policy "officer write images" on item_images for all using (is_officer()) with check (is_officer());

-- profiles
create policy "read own or admin" on profiles for select using (id = auth.uid() or is_admin());
create policy "admin manage" on profiles for all using (is_admin()) with check (is_admin());
```

### Lịch sử thay đổi (audit log)

```sql
create type history_action as enum ('insert', 'update', 'delete');

create table class_item_history (
  id bigint generated always as identity primary key,
  item_id uuid not null,                 -- KHÔNG đặt FK để giữ log sau khi item bị xóa
  action history_action not null,
  changed_by uuid references profiles(id) on delete set null,
  changed_by_name text,                  -- snapshot tên người sửa
  changed_at timestamptz not null default now(),
  old_data jsonb,                        -- null khi insert
  new_data jsonb,                        -- null khi delete
  changed_fields text[] not null default '{}',
  images_snapshot jsonb                  -- [{uc_uuid, cdn_url, sort_order}] tại thời điểm đó
);

create index on class_item_history (item_id, changed_at desc);
create index on class_item_history (changed_at desc);

-- Trigger ghi log cho class_items
create function log_class_item_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_fields text[]; v_item uuid; v_name text;
begin
  select full_name into v_name from profiles where id = auth.uid();

  if tg_op = 'INSERT' then
    v_new := to_jsonb(new); v_item := new.id;
    v_fields := array(select jsonb_object_keys(v_new));
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old); v_new := to_jsonb(new); v_item := new.id;
    select coalesce(array_agg(k), '{}') into v_fields
    from jsonb_object_keys(v_new) k
    where k <> 'updated_at' and v_new->k is distinct from v_old->k;
    if cardinality(v_fields) = 0 then return new; end if;  -- bỏ qua nếu không đổi gì
  else
    v_old := to_jsonb(old); v_item := old.id;
  end if;

  insert into class_item_history
    (item_id, action, changed_by, changed_by_name, old_data, new_data, changed_fields, images_snapshot)
  values
    (v_item, lower(tg_op)::history_action, auth.uid(), v_name, v_old, v_new, v_fields,
     (select coalesce(jsonb_agg(jsonb_build_object('uc_uuid',uc_uuid,'cdn_url',cdn_url,'sort_order',sort_order) order by sort_order),'[]')
      from item_images where item_id = v_item));
  return coalesce(new, old);
end $$;

create trigger trg_class_items_history
after insert or update or delete on class_items
for each row execute function log_class_item_change();

-- Trigger cập nhật updated_at
create function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger trg_class_items_updated before update on class_items
for each row execute function set_updated_at();

-- Thay đổi ảnh cũng tạo 1 dòng lịch sử (changed_fields = {'images'})
create function log_item_images_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_item uuid := coalesce(new.item_id, old.item_id); v_name text;
begin
  if not exists (select 1 from class_items where id = v_item) then return coalesce(new, old); end if; -- item đang bị xóa cascade
  select full_name into v_name from profiles where id = auth.uid();
  insert into class_item_history (item_id, action, changed_by, changed_by_name, changed_fields, images_snapshot)
  values (v_item, 'update', auth.uid(), v_name, array['images'],
    (select coalesce(jsonb_agg(jsonb_build_object('uc_uuid',uc_uuid,'cdn_url',cdn_url,'sort_order',sort_order) order by sort_order),'[]')
     from item_images where item_id = v_item));
  return coalesce(new, old);
end $$;
create trigger trg_item_images_history
after insert or update or delete on item_images
for each row execute function log_item_images_change();

-- RLS: chỉ officer đọc; KHÔNG có policy insert/update/delete (chỉ trigger security definer ghi được)
alter table class_item_history enable row level security;
create policy "officer read history" on class_item_history for select using (is_officer());
```

Lưu ý triển khai: ghi ảnh + item trong cùng 1 RPC / transaction để tránh sinh nhiều dòng log rời rạc khi lưu form (ưu tiên RPC `save_class_item(payload jsonb)`).

### Khôi phục phiên bản (RPC)
```sql
create function restore_class_item(p_history_id bigint) returns uuid
language plpgsql security definer set search_path = public as $$
declare h class_item_history; begin
  if not is_officer() then raise exception 'forbidden'; end if;
  select * into h from class_item_history where id = p_history_id;
  -- action = delete  -> insert lại từ old_data
  -- action = update  -> update item về old_data (bỏ id, created_at, created_by)
  -- khôi phục images từ images_snapshot (xóa item_images hiện tại, insert lại)
  -- trigger sẽ tự ghi 1 dòng lịch sử mới cho hành động khôi phục
  return h.item_id;
end $$;
```

## 5. Cấu trúc trang

| Route | Mô tả | Truy cập |
|---|---|---|
| `/` | Landing: hero + khối **Chú ý quan trọng** (ghim) + **Bài tập sắp đến hạn** + **Task lớp** | Public |
| `/homework` | Danh sách bài tập, lọc theo môn / hạn | Public |
| `/tasks` | Danh sách task lớp | Public |
| `/notices` | Danh sách chú ý | Public |
| `/items/[id]` | Chi tiết + gallery ảnh | Public |
| `/login` | Đăng nhập cán bộ bằng username + password | Public |
| `/admin` | Dashboard quản lý, nút "Thêm mới" | Officer |
| `/admin/new`, `/admin/[id]/edit` | Form tạo / sửa | Officer |
| `/admin/[id]/history` | Lịch sử thay đổi của 1 bản ghi (timeline + diff) | Officer |
| `/admin/history` | Nhật ký thay đổi toàn lớp (gồm cả bản ghi đã xóa), lọc theo người / loại / ngày | Officer |
| `/admin/officers` | Quản lý danh sách cán bộ | Admin |

## 6. Tính năng chi tiết

### Landing `/`
- Header: tên lớp, năm học, nút "Cán bộ đăng nhập"
- Section "Chú ý quan trọng": item `notice` hoặc `is_pinned`, badge màu theo priority (urgent = đỏ)
- Section "Bài tập sắp đến hạn": sort theo `due_at` tăng dần, hiển thị countdown ("còn 2 ngày"), quá hạn thì mờ đi
- Section "Task của lớp": card list, trạng thái done / chưa
- Tab lọc nhanh: Tất cả / Bài tập / Task / Chú ý
- Card hiển thị: icon theo type, tiêu đề, môn, hạn, thumbnail ảnh đầu tiên

### Form cán bộ
- Fields: type, title, description (textarea, hỗ trợ xuống dòng), subject, priority, due_at, is_pinned, is_published
- Upload nhiều ảnh (tối đa 5/item), preview trước khi lưu
- Validate bằng zod + react-hook-form
- Nút: Lưu, Lưu nháp (`is_published=false`), Đánh dấu hoàn thành; chỉ admin có nút Xóa (confirm dialog)
- Task/homework mới mặc định hạn = thời điểm tạo + 7 ngày; người tạo có thể chọn hạn khác

### Lịch sử thay đổi (UI)
- `/admin/[id]/history`: timeline dọc, mỗi dòng: avatar/tên người sửa, thời gian ("2 giờ trước" + tooltip giờ đầy đủ), badge hành động (Tạo / Sửa / Xóa / Khôi phục), danh sách trường đã đổi
- Bấm vào 1 dòng → mở diff: so sánh `old_data` vs `new_data` theo từng trường (tiêu đề, mô tả, hạn nộp, priority, ghim, trạng thái...), highlight giá trị cũ (đỏ, gạch) / mới (xanh); riêng ảnh hiển thị thumbnail trước / sau
- Nút "Khôi phục phiên bản này" (confirm dialog) → gọi RPC `restore_class_item`
- `/admin/history`: bảng phân trang (20/trang), bộ lọc: người sửa, loại item, hành động, khoảng ngày; dòng của item đã xóa có nút "Khôi phục"
- Nút "Lịch sử" trên mỗi card ở `/admin` và trong trang `/admin/[id]/edit`
- Trang public KHÔNG hiển thị lịch sử; chỉ hiện nhãn "Cập nhật lần cuối: <thời gian>" trên card / trang chi tiết
- Map tên trường sang tiếng Việt trong `lib/history.ts` (title → Tiêu đề, due_at → Hạn nộp, ...)

### Auth
- Username + password riêng; không có email, phone, hoặc Supabase Auth
- Lưu password bằng Argon2id hash; không lưu mật khẩu thuần
- Tạo session server-side ngẫu nhiên; lưu token trong cookie `HttpOnly`, `Secure`, `SameSite=Lax`, chỉ lưu hash token trong bảng `auth_sessions`
- Middleware/proxy chặn `/admin/*`; mọi Server Action/API cũng xác thực session và role, không chỉ dựa vào proxy
- Không cho đăng ký tự do; admin tạo username, mật khẩu khởi tạo và role

## 7. Tích hợp Uploadcare
- Env: `NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY` (chỉ dùng public key ở client)
- Dùng `FileUploaderRegular` với config: `imgOnly`, `multiple`, `multipleMax=5`, `maxLocalFileSizeBytes=5MB`, `sourceList="local, camera"`
- Sau upload: lấy `uuid` + `cdnUrl`, lưu vào `item_images` cùng lúc submit form
- Hiển thị ảnh qua transform URL: `${cdnUrl}-/preview/800x800/-/format/auto/-/quality/smart/` (thumbnail dùng `/preview/400x300/`)
- Xóa item: xóa row DB (ảnh trên Uploadcare giữ nguyên ở v1; để mục "backlog" xử lý bằng REST API + secret key chạy server-side)
- Cấu hình Uploadcare dashboard: bật "Store uploaded files automatically"; whitelist domain Vercel trong allowed origins

## 8. Cấu trúc thư mục

```
/app
  /(public)/page.tsx, homework/, tasks/, notices/, items/[id]/
  /login/page.tsx
  /admin/page.tsx, new/, [id]/edit/, [id]/history/, history/, officers/
/components
  ItemCard.tsx, ItemList.tsx, PriorityBadge.tsx, Countdown.tsx,
  ItemForm.tsx, ImageUploader.tsx, ImageGallery.tsx,
  HistoryTimeline.tsx, HistoryDiff.tsx, RestoreButton.tsx, HistoryFilters.tsx
/lib
  supabase/admin.ts, session.ts, auth.ts
  validators.ts, utils.ts, history.ts (map field → nhãn, tính diff)
/proxy.ts
```

## 9. Env
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY=
SUPABASE_SERVICE_ROLE_KEY=
UPLOADCARE_SECRET_KEY=
```

## 10. Các phase triển khai

**Phase 1 — Nền tảng**
- [ ] Init Next.js + Tailwind, kết nối Supabase
- [ ] Chạy SQL schema + RLS
- [ ] Username/password auth riêng, session an toàn, proxy + server-side authorization cho `/admin`

**Phase 2 — CRUD cán bộ**
- [ ] `/admin` list + filter
- [ ] ItemForm tạo / sửa / xóa
- [ ] Tích hợp Uploadcare + lưu `item_images`
- [ ] RPC `save_class_item` (item + ảnh trong 1 transaction)
- [ ] Bảng `class_item_history` + trigger + RLS

**Phase 2b — Lịch sử thay đổi**
- [ ] Trang `/admin/[id]/history`: timeline + diff
- [ ] Trang `/admin/history`: nhật ký toàn lớp + bộ lọc + phân trang
- [ ] RPC `restore_class_item` + nút khôi phục
- [ ] Test: sửa, xóa, đổi ảnh, khôi phục đều sinh log đúng

**Phase 3 — Giao diện public**
- [ ] Landing `/` với 3 section
- [ ] Trang list theo type + lọc môn
- [ ] Trang chi tiết + gallery
- [ ] Responsive mobile-first, dark mode (tuỳ chọn)

**Phase 4 — Hoàn thiện**
- [ ] `/admin/officers` quản lý cán bộ
- [ ] Revalidate cache (ISR 60s hoặc `revalidatePath` sau mỗi mutation)
- [ ] SEO meta, OG image
- [ ] Deploy Vercel, set env, test RLS bằng tài khoản không phải officer

## 11. Acceptance criteria
- Người chưa đăng nhập xem được item `published`, KHÔNG thể ghi dữ liệu (test bằng Supabase client trực tiếp)
- Officer thêm item kèm ≥1 ảnh, hiển thị đúng trên landing trong ≤60s
- Item có `is_pinned` luôn nằm đầu; `urgent` có badge đỏ
- Bài tập quá hạn hiển thị trạng thái "Đã quá hạn"
- Lighthouse mobile: Performance ≥ 85, ảnh dùng format auto + lazy load
- Không lộ secret key ở client bundle
- Mọi insert / update / delete trên `class_items` tự sinh 1 dòng `class_item_history` với đúng người sửa, `old_data`, `new_data`, `changed_fields`
- Update không đổi nội dung thực (chỉ `updated_at`) KHÔNG sinh log
- Đổi ảnh sinh log với `changed_fields = {images}` và có `images_snapshot`
- Xóa item vẫn xem được lịch sử ở `/admin/history` và khôi phục được cùng ảnh
- User không phải officer: `select` bảng `class_item_history` trả 0 dòng; officer cũng KHÔNG thể insert / update / delete trực tiếp bảng này từ client
- Khôi phục tạo thêm 1 dòng log mới (không ghi đè / xóa log cũ)

## 12. Backlog (ngoài scope v1)
- Thông báo Zalo / email khi có item urgent
- Xóa ảnh Uploadcare khi xóa item (REST API, server-side)
- Giới hạn lưu trữ log (vd. cron xóa log > 12 tháng)
- Export lịch sử ra CSV
- Học sinh đánh dấu "đã làm" (localStorage)
- Lịch tháng hiển thị deadline
- Đính kèm file PDF / tài liệu
