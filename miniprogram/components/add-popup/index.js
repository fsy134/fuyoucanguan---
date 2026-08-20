// ============================================
// 加购弹窗：选口味 + 选数量
// 菜品（有口味）：显示口味维度选项
// 套餐：显示"套餐包含"清单，只选数量
// 确认时抛出事件 confirm，参数 { dishFlavor, quantity }
// ============================================
Component({
  properties: {
    // 是否显示弹窗
    show: Boolean,
    // 菜品/套餐名称
    title: { type: String, value: '' },
    // 单价（数字）
    price: { type: Number, value: 0 },
    // 单价显示文本（如 "12.00"），由父页面算好传入
    priceText: { type: String, value: '' },
    // 口味维度：[{ name:'辣度', values:['不辣','微辣'] }, ...]
    flavors: { type: Array, value: [] },
    // 套餐包含的菜品清单：[{ name, copies }, ...]（仅套餐有）
    detailItems: { type: Array, value: [] },
    // 可多选的口味维度名（如 ['葱蒜']）：这些维度可勾选 0~多个选项，
    // 一个都不选 = 默认正常；名单外的维度仍是单选
    multiNames: { type: Array, value: [] }
  },

  data: {
    selections: {}, // 单选维度存选中的选项字符串，多选维度存选中的选项数组
    activeMap: {},  // 选项高亮表：{ '维度名|选项值': true }（供 wxml 判断高亮）
    multiMap: {},   // 哪些维度是多选：{ '葱蒜': true }（供 wxml 显示"可多选"提示）
    quantity: 1
  },

  observers: {
    // 每次弹窗打开新菜品时，重置选择（单选默认第一个；多选默认全不选）和数量
    'flavors, multiNames'(v, multiNames) {
      const selections = {};
      const activeMap = {};
      const multiMap = {};
      const multiList = multiNames || [];
      (v || []).forEach((dim) => {
        const isMulti = multiList.indexOf(dim.name) > -1;
        if (isMulti) {
          multiMap[dim.name] = true;
          selections[dim.name] = [];
        } else if (dim.values && dim.values.length) {
          selections[dim.name] = dim.values[0];
          activeMap[dim.name + '|' + dim.values[0]] = true;
        }
      });
      this.setData({ selections, activeMap, multiMap, quantity: 1 });
    }
  },

  methods: {
    // 阻止点击面板内部时冒泡到遮罩
    noop() {},

    onMaskTap() {
      this.triggerEvent('close');
    },

    onClose() {
      this.triggerEvent('close');
    },

    // 点选某个口味选项：单选=换选，多选=勾选/取消勾选
    onPickOption(e) {
      const dim = e.currentTarget.dataset.dim;
      const value = e.currentTarget.dataset.value;
      const isMulti = this.data.multiMap[dim];
      const key = dim + '|' + value;
      const selections = Object.assign({}, this.data.selections);
      const activeMap = Object.assign({}, this.data.activeMap);

      if (isMulti) {
        // 多选：点一下勾上，再点一下取消
        const list = (selections[dim] || []).slice();
        const idx = list.indexOf(value);
        if (idx > -1) {
          list.splice(idx, 1);
          delete activeMap[key];
        } else {
          list.push(value);
          activeMap[key] = true;
        }
        selections[dim] = list;
      } else {
        // 单选：清掉该维度旧选项的高亮，再点亮新选项
        const old = selections[dim];
        if (old !== undefined) {
          delete activeMap[dim + '|' + old];
        }
        selections[dim] = value;
        activeMap[key] = true;
      }
      this.setData({ selections, activeMap });
    },

    onMinus() {
      if (this.data.quantity > 1) {
        this.setData({ quantity: this.data.quantity - 1 });
      }
    },

    onPlus() {
      this.setData({ quantity: this.data.quantity + 1 });
    },

    onConfirm() {
      // 按口味定义顺序拼接字符串，如 "辣度:微辣,温度:热饮"
      // 多选维度（如葱蒜）：勾选的选项按原顺序用 + 连起来，如 "葱蒜:不要葱+不要蒜"；
      // 一个都没勾则该维度不出现（默认正常）
      // 这是购物车行的"身份证"，后端靠它区分不同口味
      const parts = [];
      this.data.flavors.forEach((dim) => {
        const sel = this.data.selections[dim.name];
        if (this.data.multiMap[dim.name]) {
          const picked = dim.values.filter((val) => (sel || []).indexOf(val) > -1);
          if (picked.length) {
            parts.push(dim.name + ':' + picked.join('+'));
          }
        } else if (sel) {
          parts.push(dim.name + ':' + sel);
        }
      });
      this.triggerEvent('confirm', {
        dishFlavor: parts.join(','),
        quantity: this.data.quantity
      });
    }
  }
});
