import layout from "@/layout/index.vue";

export default [
  {
    path: "/course",
    component: layout,
    children: [
      {
        path: "index",
        component: () => import("@/views/Course/index.vue"),
        meta: {
          title: "课程",
          isAuth: false,
        },
      },
      {
        path: "learn/:courseId/:title",
        component: () => import("@/views/Course/Learn/index.vue"),
        meta: {
          title: "课程学习",
          isAuth: true,
        },
      },
    ],
  },
];
