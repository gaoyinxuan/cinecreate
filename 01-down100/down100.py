import pygame
import pygame.freetype
import random
import sys
import os
import math

# ── 窗口 ──────────────────────────────────────────
SCREEN_W = 480
SCREEN_H = 720
FPS = 60

# ── 配色 ──────────────────────────────────────────
BG       = (12, 12, 24)
GRID     = (20, 20, 38)
PLATFORM = (0, 220, 150)
PLAT_HL  = (60, 255, 190)
PLAYER_C = (255, 85, 85)
GLOW_C   = (255, 140, 140)
WHITE    = (240, 240, 250)
GRAY     = (140, 140, 160)
GOLD     = (255, 205, 50)
DIM      = (80, 80, 100)

# ── 玩家 ──────────────────────────────────────────
PLAYER_W = 28
PLAYER_H = 28
MOVE_SPD = 360
GRAVITY  = 950
MAX_FALL = 650

# ── 平台 ──────────────────────────────────────────
PLATFORM_H = 10
FLOOR_GAP = 82          # 每层之间的垂直间距
BASE_SPEED = 90          # 初始上滚速度 (px/s)
SPEED_INC  = 7           # 每分增加的速度
SEG_MIN_W  = 60          # 单段平台最小宽度
SEG_MAX_W  = 115         # 单段平台最大宽度
MIN_PASS   = 58          # 最小可通过空隙

# ── 状态 ──────────────────────────────────────────
MENU    = 0
PLAYING = 1
OVER    = 2

# ── 字体加载 ──────────────────────────────────────
def load_font(size):
    """加载系统英文字体"""
    candidates = [
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/seguisb.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/calibri.ttf",
    ]
    for fp in candidates:
        if os.path.exists(fp):
            return pygame.freetype.Font(fp, size=size)
    return pygame.freetype.Font(None, size=size)


class Player:
    def __init__(self):
        self.reset()

    def reset(self):
        self.x = SCREEN_W / 2 - PLAYER_W / 2
        self.y = 180.0
        self.vx = 0.0
        self.vy = 0.0
        self.grounded = False

    @property
    def rect(self):
        return pygame.Rect(int(self.x), int(self.y), PLAYER_W, PLAYER_H)


class PlatformSeg:
    """一段短平台"""
    __slots__ = ('x', 'y', 'w', 'floor_id')
    def __init__(self, x, y, w, floor_id):
        self.x = x
        self.y = float(y)
        self.w = w
        self.floor_id = floor_id

    @property
    def rect(self):
        return pygame.Rect(self.x, int(self.y), self.w, PLATFORM_H)


def generate_floor(y, floor_id):
    """在指定 y 坐标生成一层的短平台段（2~3段，保证空隙足够大）"""
    n = random.randint(2, 3)
    segments = []
    attempts = 0
    while len(segments) < n and attempts < 80:
        w = random.randint(SEG_MIN_W, SEG_MAX_W)
        x = random.randint(4, SCREEN_W - w - 4)
        ok = True
        for sx, sw in segments:
            if not (x + w + MIN_PASS < sx or sx + sw + MIN_PASS < x):
                ok = False
                break
        if ok:
            segments.append((x, w))
        attempts += 1
    # 如果只生成了 1 段，强制补一段
    if len(segments) < 2:
        x2 = random.randint(SCREEN_W // 2, SCREEN_W - SEG_MIN_W - 4)
        w2 = random.randint(SEG_MIN_W, SEG_MAX_W)
        segments.append((x2, w2))

    return [PlatformSeg(x, y, w, floor_id) for x, w in segments]


def draw_platform(surf, seg):
    """绘制单段平台（圆角矩形 + 顶部高光）"""
    r = seg.rect
    pygame.draw.rect(surf, PLATFORM, r, border_radius=3)
    # 顶部高光
    hl = pygame.Rect(r.x, r.y, r.width, 3)
    pygame.draw.rect(surf, PLAT_HL, hl, border_radius=1)


def draw_player(surf, player, tick):
    """绘制玩家方块 + 呼吸光晕"""
    rx, ry = int(player.x), int(player.y)
    # 光晕
    phase = math.sin(tick * 0.07)
    r = PLAYER_W // 2 + 5 + int(3 * phase)
    glow = pygame.Surface((r * 2, r * 2), pygame.SRCALPHA)
    a = 55 + int(30 * phase)
    pygame.draw.circle(glow, (*GLOW_C, a), (r, r), r)
    surf.blit(glow, (rx + PLAYER_W // 2 - r, ry + PLAYER_H // 2 - r))
    # 主体
    pygame.draw.rect(surf, PLAYER_C, (rx, ry, PLAYER_W, PLAYER_H), border_radius=5)
    # 高光
    pygame.draw.rect(surf, (255, 150, 140),
                     (rx + 4, ry + 3, PLAYER_W - 8, PLAYER_H // 2 - 3), border_radius=3)


def draw_grid(surf, offset):
    """滚动网格背景"""
    oy = int(offset) % 48
    for y in range(-48, SCREEN_H + 48, 48):
        yy = y + oy
        if 0 <= yy <= SCREEN_H:
            pygame.draw.line(surf, GRID, (0, yy), (SCREEN_W, yy))


def render_text(font, surf, text, center, color=WHITE):
    """居中渲染文字"""
    bounds = font.get_rect(text)
    x = center[0] - bounds.width // 2
    y = center[1] - bounds.height // 2
    font.render_to(surf, (x, y), text, color)
    return pygame.Rect(x, y, bounds.width, bounds.height)


def main():
    pygame.init()
    screen = pygame.display.set_mode((SCREEN_W, SCREEN_H))
    pygame.display.set_caption("Down 100 Floors")
    clock = pygame.time.Clock()

    # 字体
    font_l = load_font(56)   # 大标题
    font_m = load_font(36)   # 中标题
    font_s = load_font(24)   # 正文
    font_xs = load_font(17)  # 小字
    font_hud = load_font(48) # HUD 分数

    player = Player()
    platforms = []     # PlatformSeg 列表
    state = MENU
    score = 0
    best = 0
    scroll_acc = 0.0
    tick = 0
    keys_down = {}
    next_floor_id = 0
    passed_floors = set()

    # ── 生成初始平台（铺满屏幕 + 额外一层） ──────────
    def populate_platforms():
        platforms.clear()
        # 从屏幕顶部到屏幕底部以下生成平台层
        y = 40.0
        fid = 0
        while y < SCREEN_H + FLOOR_GAP:
            platforms.extend(generate_floor(y, fid))
            y += FLOOR_GAP
            fid += 1
        return fid

    next_floor_id = populate_platforms()

    # ── 重置游戏 ────────────────────────────────────
    def restart_game():
        nonlocal score, scroll_acc, next_floor_id
        player.reset()
        score = 0
        scroll_acc = 0.0
        passed_floors.clear()
        next_floor_id = populate_platforms()

    # ── 把滚出屏幕顶部的平台回收到屏幕底部 ──────────
    def recycle_platforms():
        nonlocal next_floor_id
        # 找到最低的平台 y
        max_y = max((p.y for p in platforms), default=SCREEN_H)
        # 如果最低的平台还不够低，生成新层
        while max_y < SCREEN_H + FLOOR_GAP:
            new_y = max_y + FLOOR_GAP
            platforms.extend(generate_floor(new_y, next_floor_id))
            next_floor_id += 1
            max_y = new_y
        # 删除滚出屏幕顶部的平台
        to_remove = [p for p in platforms if p.y + PLATFORM_H < -20]
        for p in to_remove:
            platforms.remove(p)

    # ── 游戏主循环 ──────────────────────────────────
    running = True
    while running:
        dt = min(clock.tick(FPS) / 1000.0, 0.05)
        tick += 1

        # ── 输入 ─────────────────────────────────────
        for evt in pygame.event.get():
            if evt.type == pygame.QUIT:
                running = False
            if evt.type == pygame.KEYDOWN:
                keys_down[evt.key] = True
                # 菜单：按空格或方向键开始
                if state == MENU:
                    if evt.key in (pygame.K_SPACE, pygame.K_RETURN,
                                   pygame.K_LEFT, pygame.K_RIGHT,
                                   pygame.K_a, pygame.K_d):
                        restart_game()
                        state = PLAYING
                elif state == OVER:
                    if evt.key == pygame.K_r:
                        restart_game()
                        state = PLAYING
                    elif evt.key == pygame.K_ESCAPE:
                        state = MENU
                        player.reset()
                        next_floor_id = populate_platforms()
                elif state == PLAYING:
                    if evt.key == pygame.K_ESCAPE:
                        state = MENU
                        player.reset()
                        next_floor_id = populate_platforms()
            if evt.type == pygame.KEYUP:
                keys_down[evt.key] = False

        # ── 逻辑更新 ─────────────────────────────────
        if state == PLAYING:
            speed = BASE_SPEED + score * SPEED_INC
            scroll = speed * dt
            scroll_acc += scroll

            # 平台滚动
            for p in platforms:
                p.y -= scroll

            # 玩家跟随平台（如果站在平台上）
            if player.grounded:
                player.y -= scroll

            # 水平移动
            move = 0.0
            if keys_down.get(pygame.K_LEFT) or keys_down.get(pygame.K_a):
                move = -MOVE_SPD
            if keys_down.get(pygame.K_RIGHT) or keys_down.get(pygame.K_d):
                move += MOVE_SPD
            player.x += move * dt
            player.x = max(0.0, min(float(SCREEN_W - PLAYER_W), player.x))

            # 重力
            player.vy += GRAVITY * dt
            player.vy = min(player.vy, MAX_FALL)
            player.y += player.vy * dt

            # 碰撞检测：玩家与平台重叠且在下落，则吸附到平台顶部
            player.grounded = False
            for p in platforms:
                if player.vy >= 0 and p.rect.colliderect(player.rect):
                    # 玩家中心在平台上方才判定为踩踏（避免侧面吸附）
                    if player.y + PLAYER_H / 2 < p.rect.y + PLATFORM_H / 2:
                        player.y = p.rect.y - PLAYER_H
                        player.vy = 0
                        player.grounded = True
                        if p.floor_id not in passed_floors:
                            passed_floors.add(p.floor_id)
                            score += 1
                        break

            # 平台回收到屏幕下方
            recycle_platforms()

            # 死亡判定
            if player.y < -PLAYER_H or player.y > SCREEN_H + 30:
                if score > best:
                    best = score
                state = OVER

        # ── 渲染 ─────────────────────────────────────
        screen.fill(BG)
        draw_grid(screen, scroll_acc)

        # 平台
        for p in platforms:
            if -20 <= p.y <= SCREEN_H + 20:
                draw_platform(screen, p)

        # 玩家
        draw_player(screen, player, tick)

        # ── HUD（游戏中） ────────────────────────────
        if state == PLAYING:
            render_text(font_hud, screen, f"Floor {score}",
                        (SCREEN_W // 2, 38), WHITE)
            render_text(font_xs, screen, "Arrow Keys / A,D to Move  |  ESC to Quit",
                        (SCREEN_W // 2, SCREEN_H - 16), GRAY)

        # ── 主菜单 ───────────────────────────────────
        if state == MENU:
            # 半透明遮罩
            shade = pygame.Surface((SCREEN_W, SCREEN_H))
            shade.set_alpha(170)
            shade.fill((6, 6, 16))
            screen.blit(shade, (0, 0))

            cy = SCREEN_H // 2 - 80
            render_text(font_l, screen, "DOWN 100",
                        (SCREEN_W // 2, cy), GOLD)
            render_text(font_m, screen, "F L O O R S",
                        (SCREEN_W // 2, cy + 44), GOLD)
            render_text(font_s, screen, "Navigate gaps and keep falling down",
                        (SCREEN_W // 2, cy + 92), GRAY)
            render_text(font_s, screen, "Don't get pushed off screen or fall into the void",
                        (SCREEN_W // 2, cy + 122), GRAY)
            render_text(font_m, screen, "Press SPACE to Start",
                        (SCREEN_W // 2, cy + 182), WHITE)
            if best > 0:
                render_text(font_s, screen, f"Best: Floor {best}",
                            (SCREEN_W // 2, cy + 230), GOLD)
            render_text(font_xs, screen, "Arrow Keys / A,D to Move  |  ESC to Quit",
                        (SCREEN_W // 2, SCREEN_H - 24), DIM)

        # ── 结束画面 ─────────────────────────────────
        if state == OVER:
            shade = pygame.Surface((SCREEN_W, SCREEN_H))
            shade.set_alpha(175)
            shade.fill((6, 6, 16))
            screen.blit(shade, (0, 0))

            cy = SCREEN_H // 2 - 70
            render_text(font_l, screen, "GAME OVER",
                        (SCREEN_W // 2, cy), PLAYER_C)
            render_text(font_m, screen, f"Floor {score}",
                        (SCREEN_W // 2, cy + 56), WHITE)
            if score >= best:
                render_text(font_s, screen, "NEW RECORD!",
                            (SCREEN_W // 2, cy + 96), GOLD)
            else:
                render_text(font_s, screen, f"Best: Floor {best}",
                            (SCREEN_W // 2, cy + 96), GOLD)
            render_text(font_m, screen, "Press R to Retry",
                        (SCREEN_W // 2, cy + 150), WHITE)
            render_text(font_s, screen, "Press ESC for Menu",
                        (SCREEN_W // 2, cy + 188), GRAY)

        pygame.display.flip()

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()
