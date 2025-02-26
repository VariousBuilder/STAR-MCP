import xml.etree.ElementTree as ET
import ezdxf
from svg.path import parse_path
import math
import re

# --- ユーザの指定に基づく定数 ---
# 10pt -> DXFで文字高さ 250
# つまり1pt は25の倍率で変換する
PT_TO_DXF = 25.0

# パスサンプリングピッチ (単位: SVG座標系における長さ)
# この値が小さいほど曲線が細かく分割される。大きいほど頂点数が減る。
PATH_SAMPLING_INTERVAL = 10.0

# Styleをパースして得られるstroke-widthなどをDXFに換算するときの倍率
# SVGユーザーユニットをDXFの長さになおすスケール。必要に応じて調整して。
SVG_UNIT_TO_DXF = 1.0


def parse_style(style_str):
    """
    style="fill:#ffffff;stroke:#000000;stroke-width:2; font-size:12pt" のようなものを
    key-valueのdictにまとめて返す。
    例: {
      'fill': '#ffffff',
      'stroke': '#000000',
      'stroke-width': '2',
      'font-size': '12pt',
      ...
    }
    """
    style_dict = {}
    items = style_str.split(';')
    for item in items:
        item = item.strip()
        if not item:
            continue
        if ':' not in item:
            continue
        k, v = item.split(':', 1)
        style_dict[k.strip()] = v.strip()
    return style_dict

def hex_to_int_rgb(hex_str):
    """
    "#RRGGBB" -> (R, G, B) を(0~255, 0~255, 0~255)で返す
    """
    hex_str = hex_str.strip()
    if hex_str.startswith('#'):
        hex_str = hex_str[1:]
    if len(hex_str) == 3:
        # #RGB の省略形は面倒なので無視/または拡張
        # ここでは単純化のため #RGB は扱わない
        r = int(hex_str[0]*2, 16)
        g = int(hex_str[1]*2, 16)
        b = int(hex_str[2]*2, 16)
        return (r, g, b)
    elif len(hex_str) == 6:
        r = int(hex_str[0:2], 16)
        g = int(hex_str[2:4], 16)
        b = int(hex_str[4:6], 16)
        return (r, g, b)
    return (0, 0, 0)  # fallback

def rgb_to_truecolor(r, g, b):
    """
    RGB(0~255) -> TrueColor (int)
    ezdxf で設定するときに使うフォーマット (0x00RRGGBB)
    """
    return (r << 16) | (g << 8) | b

def parse_transform(transform_str):
    """
    SVGのtransform文字列をパースして、2Dアフィン変換行列（[a, c, e, b, d, f]）を返す。
    """
    def mat_mult(m1, m2):
        a1, c1, e1, b1, d1, f1 = m1
        a2, c2, e2, b2, d2, f2 = m2
        return [
            a1*a2 + c1*b2,
            a1*c2 + c1*d2,
            a1*e2 + c1*f2 + e1,
            b1*a2 + d1*b2,
            b1*c2 + d1*d2,
            b1*e2 + d1*f2 + f1
        ]
    matrix_acc = [1, 0, 0, 0, 1, 0]  # identity
    pattern = re.compile(r'(matrix|translate|scale|rotate|skewX|skewY)\((.*?)\)')
    transforms = pattern.findall(transform_str.replace('\n', ''))
    for t_type, t_args in transforms:
        nums = re.split(r'[\s,]+', t_args.strip())
        nums = [float(n) for n in nums if n != '']

        if t_type == 'matrix':
            if len(nums) == 6:
                mat_current = [nums[0], nums[2], nums[4],
                               nums[1], nums[3], nums[5]]
            else:
                mat_current = [1, 0, 0, 0, 1, 0]
        elif t_type == 'translate':
            tx = nums[0]
            ty = nums[1] if len(nums) > 1 else 0.0
            mat_current = [1, 0, tx, 0, 1, ty]
        elif t_type == 'scale':
            sx = nums[0]
            sy = nums[1] if len(nums) > 1 else sx
            mat_current = [sx, 0, 0, 0, sy, 0]
        elif t_type == 'rotate':
            angle = math.radians(nums[0])
            cx = 0.0
            cy = 0.0
            if len(nums) > 2:
                cx, cy = nums[1], nums[2]
            cos_ = math.cos(angle)
            sin_ = math.sin(angle)
            # translate(-cx, -cy)
            trans1 = [1, 0, -cx, 0, 1, -cy]
            # rotate(angle)
            rot = [cos_, -sin_, 0, sin_, cos_, 0]
            # translate(cx, cy)
            trans2 = [1, 0, cx, 0, 1, cy]
            mat_current = mat_mult(mat_mult(trans1, rot), trans2)
        elif t_type == 'skewX':
            angle = math.radians(nums[0])
            mat_current = [1, math.tan(angle), 0, 0, 1, 0]
        elif t_type == 'skewY':
            angle = math.radians(nums[0])
            mat_current = [1, 0, 0, math.tan(angle), 1, 0]
        else:
            mat_current = [1, 0, 0, 0, 1, 0]
        
        matrix_acc = mat_mult(matrix_acc, mat_current)
    return matrix_acc

def apply_matrix(point, matrix):
    x, y = point
    a, c, e, b, d, f = matrix
    x_new = a * x + c * y + e
    y_new = b * x + d * y + f
    return (x_new, y_new)

def combine_transforms(parent_matrix, child_transform_str):
    """
    親の行列と子のtransformを掛け合わせた行列を返す
    """
    if not child_transform_str and parent_matrix is None:
        return None
    child_matrix = [1, 0, 0, 0, 1, 0]
    if child_transform_str:
        child_matrix = parse_transform(child_transform_str)
    if parent_matrix is None:
        return child_matrix
    
    def mat_mult(m1, m2):
        a1, c1, e1, b1, d1, f1 = m1
        a2, c2, e2, b2, d2, f2 = m2
        return [
            a1*a2 + c1*b2,
            a1*c2 + c1*d2,
            a1*e2 + c1*f2 + e1,
            b1*a2 + d1*b2,
            b1*c2 + d1*d2,
            b1*e2 + d1*f2 + f1
        ]
    return mat_mult(parent_matrix, child_matrix)

def matrix_to_rotation_scale(matrix):
    """
    行列 [a, c, e, b, d, f] から
    回転角(deg)とスケール(sx, sy)をざっくり取り出す。
    ただし skew が混ざっている場合は正しくは扱えない。
    """
    a, c, e, b, d, f = matrix
    # スケール
    sx = math.sqrt(a*a + b*b)
    sy = math.sqrt(c*c + d*d)
    # 回転(とりあえずX軸まわりの回転角っぽいもの)
    # 参考: rotation = atan2(b, a) in degrees
    rotation_rad = math.atan2(b, a)
    rotation_deg = math.degrees(rotation_rad)
    return rotation_deg, sx, sy

def extract_dxf_attribs(elem):
    """
    SVG要素から色や線幅などを取り出して、ezdxf向けのdxfattribs(dict)を返す。
    """
    dxfattribs = {}
    # style から取得
    style_attr = elem.attrib.get('style', '')
    style_dict = parse_style(style_attr) if style_attr else {}
    
    # stroke or fill
    # stroke優先で色を決めるかどうかなど運用次第で変わるけど、ここでは stroke を色とする例
    stroke = style_dict.get('stroke', None) or elem.attrib.get('stroke', None)
    if stroke and stroke != 'none':
        r, g, b = hex_to_int_rgb(stroke)
        dxfattribs['true_color'] = rgb_to_truecolor(r, g, b)
    # stroke-width
    sw_str = style_dict.get('stroke-width', None) or elem.attrib.get('stroke-width', None)
    if sw_str and sw_str != 'none':
        try:
            sw_val = float(sw_str)
            # DXFのlineweightは100分の1 mm単位らしく、適宜変換は必要
            # とりあえずSVGユーザーユニットを mm に読み替える場合など
            # 適宜変換。この例では単純にSVG_UNIT_TO_DXF倍にしてみる。
            lineweight = sw_val * SVG_UNIT_TO_DXF
            # ezdxfは lineweight を 0.00 ~ 2.11 mm の範囲で指定するみたい
            # 単位が 100分の1 mm で設定されるので => lineweight * 100
            dxfattribs['lineweight'] = int(lineweight * 100)
        except:
            pass

    # fill など他にも使いたい場合に追加

    return dxfattribs

def parse_and_draw_svg_element(elem, msp, current_matrix=None):
    tag = elem.tag.split('}')[-1]
    this_transform_str = elem.attrib.get('transform', None)
    new_matrix = combine_transforms(current_matrix, this_transform_str)
    
    if tag in ['g', 'svg']:
        for child in elem:
            parse_and_draw_svg_element(child, msp, new_matrix)
        return

    # DXFに適用したい共通属性
    dxfattribs = extract_dxf_attribs(elem)

    if tag == 'circle':
        cx = float(elem.attrib.get('cx', '0'))
        cy = float(elem.attrib.get('cy', '0'))
        r = float(elem.attrib.get('r', '0'))
        center = apply_matrix((cx, cy), new_matrix) if new_matrix else (cx, cy)
        # 半径もスケール変換したいなら、行列から読み取りが必要だが
        # 単純にx方向スケールをかけるなど色々ルールがある。
        # ここでは一律スケール(SVG_UNIT_TO_DXF)のみとかにする例。
        if new_matrix:
            # ざっくり: x方向スケールだけ使う(またはxy平均スケール)
            _, sx, sy = matrix_to_rotation_scale(new_matrix)
            r = r * (sx + sy) / 2.0
        r *= SVG_UNIT_TO_DXF
        msp.add_circle(center=center, radius=r, dxfattribs=dxfattribs)

    elif tag == 'rect':
        x = float(elem.attrib.get('x', '0'))
        y = float(elem.attrib.get('y', '0'))
        width = float(elem.attrib.get('width', '0'))
        height = float(elem.attrib.get('height', '0'))
        points = [
            (x, y),
            (x+width, y),
            (x+width, y+height),
            (x, y+height),
            (x, y)
        ]
        # 変換適用
        if new_matrix:
            points = [apply_matrix(pt, new_matrix) for pt in points]
        # SVG -> DXF長さ変換
        points = [(px*SVG_UNIT_TO_DXF, py*SVG_UNIT_TO_DXF) for (px, py) in points]
        msp.add_lwpolyline(points, close=True, dxfattribs=dxfattribs)

    elif tag == 'line':
        x1 = float(elem.attrib.get('x1', '0'))
        y1 = float(elem.attrib.get('y1', '0'))
        x2 = float(elem.attrib.get('x2', '0'))
        y2 = float(elem.attrib.get('y2', '0'))
        start = apply_matrix((x1, y1), new_matrix) if new_matrix else (x1, y1)
        end = apply_matrix((x2, y2), new_matrix) if new_matrix else (x2, y2)
        start = (start[0]*SVG_UNIT_TO_DXF, start[1]*SVG_UNIT_TO_DXF)
        end = (end[0]*SVG_UNIT_TO_DXF, end[1]*SVG_UNIT_TO_DXF)
        msp.add_line(start, end, dxfattribs=dxfattribs)

    elif tag in ['polyline', 'polygon']:
        points_str = elem.attrib.get('points', '').strip()
        if not points_str:
            return
        raw_points = points_str.replace('\n', ' ').split()
        points = []
        for pair in raw_points:
            x_str, y_str = pair.split(',')
            x_f = float(x_str)
            y_f = float(y_str)
            if new_matrix:
                x_f, y_f = apply_matrix((x_f, y_f), new_matrix)
            x_f *= SVG_UNIT_TO_DXF
            y_f *= SVG_UNIT_TO_DXF
            points.append((x_f, y_f))
        msp.add_lwpolyline(points, close=(tag=='polygon'), dxfattribs=dxfattribs)

    elif tag == 'path':
        d = elem.attrib.get('d', '')
        path_obj = parse_path(d)
        points = []
        for seg in path_obj:
            seg_length = seg.length(error=1e-4)
            # PATH_SAMPLING_INTERVAL ごとにサンプリング
            num_samples = max(2, int(math.ceil(seg_length / PATH_SAMPLING_INTERVAL)))
            for i in range(num_samples):
                t = i / (num_samples - 1)
                point_complex = seg.point(t)
                x_f = point_complex.real
                y_f = point_complex.imag
                if new_matrix:
                    x_f, y_f = apply_matrix((x_f, y_f), new_matrix)
                x_f *= SVG_UNIT_TO_DXF
                y_f *= SVG_UNIT_TO_DXF
                points.append((x_f, y_f))
        if points:
            msp.add_lwpolyline(points, close=False, dxfattribs=dxfattribs)

    elif tag == 'text':
        x = float(elem.attrib.get('x', '0'))
        y = float(elem.attrib.get('y', '0'))
        text_content = ''.join(elem.itertext()).strip()
        
        # font-size を取得 (pt単位前提で超単純に解釈)
        style_attr = elem.attrib.get('style', '')
        style_dict = parse_style(style_attr) if style_attr else {}
        font_size_str = style_dict.get('font-size', elem.attrib.get('font-size', '10pt'))
        # "12pt" のような表記を想定
        font_pt = 10.0
        if font_size_str:
            match_pt = re.search(r'([\d\.]+)pt', font_size_str)
            if match_pt:
                font_pt = float(match_pt.group(1))

        # transform行列を使って回転＆スケールを抽出
        rotation_deg = 0.0
        scale_avg = 1.0
        if new_matrix:
            x, y = apply_matrix((x, y), new_matrix)
            rot, sx, sy = matrix_to_rotation_scale(new_matrix)
            rotation_deg = rot
            # シアーが入ってたらずれるけど、ここでは単純に平均スケール
            scale_avg = (sx + sy) / 2.0
        else:
            # 変換なし
            pass

        # 最終的な文字高さ(DXF)
        #   (SVGのfont-size pt) * (pt->DXF変換 25) * (transformスケール) 
        text_height_dxf = font_pt * PT_TO_DXF * scale_avg

        x_dxf = x * SVG_UNIT_TO_DXF
        y_dxf = y * SVG_UNIT_TO_DXF

        txt = msp.add_text(
            text_content,
            dxfattribs={
                'height': text_height_dxf,
                'rotation': rotation_deg,
                **dxfattribs
            }
        )
        # 挿入位置
        txt.set_pos((x_dxf, y_dxf))

    # 他要素(ellipse 等)があれば追加実装


def svg_to_dxf(svg_file, dxf_file):
    tree = ET.parse(svg_file)
    root = tree.getroot()

    doc = ezdxf.new(dxfversion='R2013')
    msp = doc.modelspace()
    parse_and_draw_svg_element(root, msp, current_matrix=None)
    doc.saveas(dxf_file)
    print(f"DXFファイル '{dxf_file}' を生成完了！")

def main():
    input_mmd = 'diagram.mmd'
    svg_file = 'diagram.svg'
    dxf_file = 'diagram.dxf'
    
    # もし mermaid-cli でSVGを生成するなら
    # import subprocess
    # subprocess.run(['mmdc', '-i', input_mmd, '-o', svg_file], check=True)
    
    svg_to_dxf(svg_file, dxf_file)

if __name__ == '__main__':
    main()
